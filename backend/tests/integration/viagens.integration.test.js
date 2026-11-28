import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
import { cleanupTenant, createSecondaryTenantAdmin, loginWithCredentials } from "../helpers/dbTestFixtures.js";

const skip = shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI";
const PASSWORD = "Viagens12345!";

async function tipoGasto(nome) {
  return prisma.tipos_gastos.upsert({ where: { nome_tipo: nome }, update: {}, create: { nome_tipo: nome } });
}

async function setupTenant(stamp, label) {
  const admin = await createSecondaryTenantAdmin({
    slug: `viag-${label}-${stamp}`,
    email: `viag-${label}-${stamp}@saas.test`,
    nome: `Viagens ${label}`,
    billingExempt: true,
    features: { ordem_coleta: false, notas_estoque: false },
  });
  const auth = await loginWithCredentials(app, admin.email, admin.password);
  const tid = admin.tenant.id;
  const caminhao = await prisma.caminhoes.create({
    data: { tenant_id: tid, placa: `V${label}${stamp.slice(-5)}`.toUpperCase().slice(0, 7), qtd_pneus: 6, km_atual: 1000, tipo_veiculo: "truck" },
  });
  const carreta = await prisma.caminhoes.create({
    data: { tenant_id: tid, placa: `K${label}${stamp.slice(-5)}`.toUpperCase().slice(0, 7), qtd_pneus: 6, km_atual: 0, tipo_veiculo: "carreta" },
  });
  const motorista = await prisma.motoristas.create({ data: { tenant_id: tid, nome: `Motorista ${label}` } });
  return { admin, auth, tid, caminhao, carreta, motorista };
}

/** Cria usuário com permissões configuradas pelo admin e devolve o login dele. */
async function userWith(adminAuth, stamp, label, role, permissions) {
  const email = `viag-${label}-${stamp}@saas.test`;
  const created = await request(app)
    .post("/api/users")
    .set(adminAuth.authHeader)
    .send({ email, nome: `Usuário ${label}`, password: PASSWORD, role });
  assert.equal(created.status, 201, created.body?.error);
  if (permissions) {
    const patched = await request(app)
      .patch(`/api/users/${created.body.data.id}`)
      .set(adminAuth.authHeader)
      .send({ permissions });
    assert.equal(patched.status, 200, patched.body?.error);
    assert.deepEqual([...patched.body.data.permissions].filter((p) => p.startsWith("viagens")).sort(), [...permissions].filter((p) => p.startsWith("viagens")).sort());
  }
  return loginWithCredentials(app, email, PASSWORD);
}

test("viagens: fluxo completo, permissões granulares, histórico e isolamento", { skip }, async () => {
  const stamp = Date.now().toString(36);
  const A = await setupTenant(stamp, "a");
  const B = await setupTenant(stamp, "b");
  try {
    const combustivel = await tipoGasto("Combustível");
    const pedagio = await tipoGasto("Pedágio");
    const H = A.auth.authHeader;
    const saida = new Date(Date.now() - 5 * 3600_000);

    // Carreta não viaja sozinha.
    const carreta = await request(app).post("/api/viagens").set(H).send({
      caminhao_id: A.carreta.id, motorista_id: A.motorista.id, saida_em: saida, origem: "Curitiba", destino: "Santos", km_inicial: 0,
    });
    assert.equal(carreta.status, 400);

    // ETAPA 1 — início
    const start = await request(app).post("/api/viagens").set(H).send({
      caminhao_id: A.caminhao.id, motorista_id: A.motorista.id, saida_em: saida, origem: "Curitiba - PR", destino: "Santos - SP", km_inicial: 1000, observacoes: "Carga de grãos",
    });
    assert.equal(start.status, 201, start.body?.error);
    const v = start.body.data;
    assert.equal(v.status, "em_andamento");
    assert.equal(v.numero, 1);
    assert.equal(v.iniciado_por.nome, "Admin Tenant B");

    // Mesmo caminhão não entra em duas viagens ao mesmo tempo.
    const dup = await request(app).post("/api/viagens").set(H).send({
      caminhao_id: A.caminhao.id, motorista_id: A.motorista.id, saida_em: saida, origem: "Ponta Grossa", destino: "Joinville", km_inicial: 1000,
    });
    assert.equal(dup.status, 409);

    // ETAPA 2 — despesas (uma com comprovante)
    const d1 = await request(app)
      .post(`/api/viagens/${v.id}/despesas`)
      .set(H)
      .field("tipo_gasto_id", String(combustivel.id))
      .field("descricao", "Diesel posto BR 116")
      .field("valor", "600.50")
      .field("registrado_em", new Date(Date.now() - 4 * 3600_000).toISOString())
      .field("quantidade_combustivel", "100")
      .attach("comprovante", Buffer.from("%PDF-1.4 teste"), { filename: "nota.pdf", contentType: "application/pdf" });
    assert.equal(d1.status, 201, d1.body?.error);
    assert.equal(d1.body.data.valor, 600.5);
    assert.equal(d1.body.data.tem_comprovante, true);
    const d2 = await request(app).post(`/api/viagens/${v.id}/despesas`).set(H).send({
      tipo_gasto_id: pedagio.id, descricao: "Pedágio Régis", valor: 99.5, registrado_em: new Date(Date.now() - 3 * 3600_000),
    });
    assert.equal(d2.status, 201, d2.body?.error);
    const pdf = await request(app).get(`/api/viagens/${v.id}/despesas/${d1.body.data.id}/comprovante`).set(H);
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers["content-type"], /pdf/);

    // A despesa é um gasto da frota (entra em relatórios), mas só muda pela viagem.
    const gasto = await prisma.gastos.findUnique({ where: { id: d2.body.data.id } });
    assert.equal(gasto.caminhao_id, A.caminhao.id);
    assert.equal(gasto.viagem_id, v.id);
    const viaGastos = await request(app).delete(`/api/gastos/${d2.body.data.id}`).set(H);
    assert.equal(viaGastos.status, 409);

    // Despesa no futuro é recusada.
    const futura = await request(app).post(`/api/viagens/${v.id}/despesas`).set(H).send({
      tipo_gasto_id: pedagio.id, descricao: "Futuro", valor: 10, registrado_em: new Date(Date.now() + 3 * 86400_000),
    });
    assert.equal(futura.status, 400);

    // ETAPA 3 — encerramento com validações
    const kmMenor = await request(app).post(`/api/viagens/${v.id}/encerrar`).set(H).send({ chegada_em: new Date(), km_final: 900 });
    assert.equal(kmMenor.status, 400);
    const antes = await request(app).post(`/api/viagens/${v.id}/encerrar`).set(H).send({ chegada_em: new Date(saida.getTime() - 60_000), km_final: 1500 });
    assert.equal(antes.status, 400);
    const fim = await request(app).post(`/api/viagens/${v.id}/encerrar`).set(H).send({
      chegada_em: new Date(), km_final: 1350, observacoes_encerramento: "Entregue", ocorrencias: "Pneu furado na serra",
    });
    assert.equal(fim.status, 200, fim.body?.error);
    const f = fim.body.data;
    assert.equal(f.status, "finalizada");
    assert.equal(f.km_percorrido, 350);
    assert.equal(f.total_despesas, 700);
    assert.equal(f.custo_por_km, 2);
    assert.ok(f.duracao_min >= 299 && f.duracao_min <= 301, String(f.duracao_min));
    assert.equal(f.tem_ocorrencia, true);
    const cam = await prisma.caminhoes.findUnique({ where: { id: A.caminhao.id } });
    assert.equal(cam.km_atual, 1350, "km do caminhão acompanha o encerramento");

    // Editar viagem finalizada exige motivo e vai para o histórico.
    const semMotivo = await request(app).patch(`/api/viagens/${v.id}`).set(H).send({ destino: "Santos (porto)" });
    assert.equal(semMotivo.status, 400);
    const edit = await request(app).patch(`/api/viagens/${v.id}`).set(H).send({ destino: "Santos (porto)", motivo: "Destino exato" });
    assert.equal(edit.status, 200, edit.body?.error);

    // Exclusão de despesa: só com motivo, e o retrato fica no histórico.
    const delSem = await request(app).delete(`/api/viagens/${v.id}/despesas/${d2.body.data.id}`).set(H).send({});
    assert.equal(delSem.status, 400);
    const del = await request(app).delete(`/api/viagens/${v.id}/despesas/${d2.body.data.id}`).set(H).send({ motivo: "Lançado em duplicidade" });
    assert.equal(del.status, 200, del.body?.error);

    const hist = await request(app).get(`/api/viagens/${v.id}/historico`).set(H);
    assert.equal(hist.status, 200);
    const acoes = hist.body.data.map((h) => h.acao);
    for (const a of ["criada", "iniciada", "despesa_registrada", "encerrada", "editada", "despesa_excluida"]) {
      assert.ok(acoes.includes(a), `histórico sem ${a}: ${acoes}`);
    }
    const excl = hist.body.data.find((h) => h.acao === "despesa_excluida");
    assert.equal(excl.alteracoes.valor, 99.5);
    assert.equal(excl.motivo, "Lançado em duplicidade");
    assert.equal(excl.usuario.nome, "Admin Tenant B");
    assert.equal(excl.alteracoes.comprovante_path, undefined, "caminho interno do arquivo não vai para a API");

    // Painel e relatório
    const resumo = await request(app).get("/api/viagens/resumo").set(H);
    assert.equal(resumo.status, 200);
    assert.equal(resumo.body.data.finalizadas, 1);
    assert.equal(resumo.body.data.km_percorrido, 350);
    assert.equal(resumo.body.data.com_ocorrencias, 1);
    assert.equal(resumo.body.data.total_despesas, 600.5);
    const rel = await request(app).get("/api/viagens/relatorio").set(H);
    assert.equal(rel.status, 200);
    assert.equal(rel.body.data.por_caminhao[0].km, 350);
    assert.equal(rel.body.data.por_categoria[0].total, 600.5);

    // Filtros da lista
    const ocorr = await request(app).get("/api/viagens").query({ com_ocorrencias: 1, status: "finalizada", destino: "porto" }).set(H);
    assert.equal(ocorr.body.data.total, 1);

    // ——— Permissões ———
    // Motorista: inicia e encerra, não vê valores nem relatórios, não vê gastos da frota.
    const motoristaPerms = ["viagens.read", "viagens.create", "viagens.start", "viagens.finish", "viagens.despesas.read", "viagens.despesas.create"];
    const mot = await userWith(A.auth, stamp, "mot", "operator", motoristaPerms);
    const mv = await request(app).get(`/api/viagens/${v.id}`).set(mot.authHeader);
    assert.equal(mv.status, 200);
    assert.equal(mv.body.data.total_despesas, null);
    assert.equal(mv.body.data.custo_por_km, null);
    assert.equal(mv.body.data.despesas[0].valor, null);
    assert.equal(mv.body.data.despesas_por_categoria, undefined);
    const mh = await request(app).get(`/api/viagens/${v.id}/historico`).set(mot.authHeader);
    assert.equal(mh.body.data.find((h) => h.acao === "despesa_excluida").alteracoes.valor, undefined);
    assert.equal(mh.body.data.find((h) => h.acao === "encerrada").alteracoes.total_despesas, undefined);
    assert.equal((await request(app).get("/api/viagens/relatorio").set(mot.authHeader)).status, 403);
    assert.equal((await request(app).get("/api/gastos").set(mot.authHeader)).status, 403, "valores da frota também ficam fechados");
    assert.equal((await request(app).get("/api/viagens/resumo").set(mot.authHeader)).body.data.total_despesas, null);
    assert.equal((await request(app).patch(`/api/viagens/${v.id}`).set(mot.authHeader).send({ origem: "Outra cidade", motivo: "teste" })).status, 403);
    const delMot = await request(app).delete(`/api/viagens/${v.id}/despesas/${d1.body.data.id}`).set(mot.authHeader).send({ motivo: "teste" });
    assert.equal(delMot.status, 403);

    // Funcionário: registra despesa mas não vê custo; não cria viagem.
    const func = await userWith(A.auth, stamp, "func", "operator", ["viagens.read", "viagens.despesas.create"]);
    assert.equal((await request(app).post("/api/viagens").set(func.authHeader).send({
      caminhao_id: A.caminhao.id, motorista_id: A.motorista.id, saida_em: new Date(), origem: "Araucária", destino: "Blumenau", km_inicial: 1350,
    })).status, 403);
    const fd = await request(app).post(`/api/viagens/${v.id}/despesas`).set(func.authHeader).send({
      tipo_gasto_id: pedagio.id, descricao: "Pedágio volta", valor: 45, registrado_em: new Date(),
    });
    assert.equal(fd.status, 201, fd.body?.error);
    assert.equal(fd.body.data.valor, null, "lança o valor mas não o vê de volta");
    const fget = await request(app).get(`/api/viagens/${v.id}`).set(func.authHeader);
    assert.equal(fget.body.data.despesas, null, "sem viagens.despesas.read não lista despesas");
    assert.equal(fget.body.data.total_despesas, null);
    assert.equal((await request(app).get(`/api/viagens/${v.id}/despesas`).set(func.authHeader)).status, 403);

    // Criar planejada sem poder iniciar.
    const plan = await userWith(A.auth, stamp, "plan", "viewer", ["viagens.read", "viagens.create"]);
    const semStart = await request(app).post("/api/viagens").set(plan.authHeader).send({
      caminhao_id: A.caminhao.id, motorista_id: A.motorista.id, saida_em: new Date(), origem: "Araucária", destino: "Blumenau", km_inicial: 1350,
    });
    assert.equal(semStart.status, 403);
    const planejada = await request(app).post("/api/viagens").set(plan.authHeader).send({
      caminhao_id: A.caminhao.id, motorista_id: A.motorista.id, saida_em: new Date(Date.now() + 86400_000), origem: "Araucária", destino: "Blumenau", km_inicial: 1350, iniciar: false,
    });
    assert.equal(planejada.status, 201, planejada.body?.error);
    assert.equal(planejada.body.data.status, "planejada");
    assert.equal(planejada.body.data.numero, 2);

    // Revogação não afeta administrador e perfil padrão continua igual.
    const viewer = await userWith(A.auth, stamp, "view", "viewer");
    const vv = await request(app).get(`/api/viagens/${v.id}`).set(viewer.authHeader);
    assert.equal(vv.status, 200);
    assert.equal(vv.body.data.total_despesas, 645.5);
    assert.equal((await request(app).post("/api/viagens").set(viewer.authHeader).send({})).status, 403);

    // Só admin configura permissões.
    const usersList = await request(app).get("/api/users").set(mot.authHeader);
    assert.equal(usersList.status, 403);

    // Cancelamento e iniciar planejada
    const cancel = await request(app).post(`/api/viagens/${planejada.body.data.id}/cancelar`).set(H).send({ motivo: "Cliente desistiu" });
    assert.equal(cancel.status, 200);
    assert.equal(cancel.body.data.status, "cancelada");
    assert.equal((await request(app).post(`/api/viagens/${planejada.body.data.id}/iniciar`).set(H).send({})).status, 409);

    // ——— Isolamento entre empresas ———
    const HB = B.auth.authHeader;
    assert.equal((await request(app).get(`/api/viagens/${v.id}`).set(HB)).status, 404);
    assert.equal((await request(app).get(`/api/viagens/${v.id}/historico`).set(HB)).status, 404);
    assert.equal((await request(app).get(`/api/viagens/${v.id}/despesas/${d1.body.data.id}/comprovante`).set(HB)).status, 404);
    assert.equal((await request(app).post(`/api/viagens/${v.id}/despesas`).set(HB).send({
      tipo_gasto_id: pedagio.id, descricao: "Invasão", valor: 1, registrado_em: new Date(),
    })).status, 404);
    // Empresa B não usa caminhão nem motorista da A.
    assert.equal((await request(app).post("/api/viagens").set(HB).send({
      caminhao_id: A.caminhao.id, motorista_id: B.motorista.id, saida_em: new Date(), origem: "Araucária", destino: "Blumenau", km_inicial: 0,
    })).status, 400);
    assert.equal((await request(app).post("/api/viagens").set(HB).send({
      caminhao_id: B.caminhao.id, motorista_id: A.motorista.id, saida_em: new Date(), origem: "Araucária", destino: "Blumenau", km_inicial: 0,
    })).status, 400);
    const listB = await request(app).get("/api/viagens").set(HB);
    assert.equal(listB.body.data.total, 0);
    // Numeração é por empresa.
    const vb = await request(app).post("/api/viagens").set(HB).send({
      caminhao_id: B.caminhao.id, motorista_id: B.motorista.id, saida_em: new Date(), origem: "Araucária", destino: "Blumenau", km_inicial: 1000,
    });
    assert.equal(vb.status, 201, vb.body?.error);
    assert.equal(vb.body.data.numero, 1);

    // Caminhão com viagens não é apagado (nem em cascata).
    const delCam = await request(app).delete(`/api/caminhoes/${A.caminhao.placa}`).set(H);
    assert.ok([400, 409].includes(delCam.status), String(delCam.status));
  } finally {
    await cleanupTenant(A.tid);
    await cleanupTenant(B.tid);
  }
});
