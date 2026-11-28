import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";
import { PERMISSIONS } from "../../utils/permissions.js";
import { syncKmFromRegistro } from "../KmCaminhaoService.js";
import { ObjectStorage } from "../ObjectStorage.js";
import {
  VIAGENS_ROOT,
  ensureUploadDirs,
  resolverPathNaRaiz,
  viagemDocsDir,
} from "../../utils/uploadPaths.js";
import {
  DESPESA_ANTES_SAIDA_MS,
  assertEncerramentoValido,
  assertNotFuture,
  assertPermission,
  dataLocalBrasil,
  diffFields,
  httpError,
  sanitizeHistoricoAlteracoes,
  viagemIndicadores,
  viagemVisibility,
} from "./viagemRules.js";

/**
 * Controle de viagens e operações.
 *
 * Toda função recebe `actor` = { id, nome, email, permissions } (req.context.user).
 * As rotas já exigem a permissão principal; aqui ficam as regras compostas
 * (ex.: criar já iniciando exige criar + iniciar) e o corte dos campos
 * financeiros conforme `viagens.financeiro`.
 */

const userNome = { select: { id: true, nome: true } };

const viagemInclude = {
  caminhoes: { select: { id: true, placa: true, marca: true, modelo: true, tipo_veiculo: true } },
  motoristas: { select: { id: true, nome: true } },
  criado_por_user: userNome,
  iniciado_por_user: userNome,
  encerrado_por_user: userNome,
  cancelado_por_user: userNome,
};

const despesaInclude = {
  tipos_gastos: { select: { id: true, nome_tipo: true } },
  criado_por_user: userNome,
};

const EDITABLE_FIELDS = [
  "caminhao_id",
  "motorista_id",
  "saida_em",
  "chegada_em",
  "origem",
  "destino",
  "km_inicial",
  "km_final",
  "observacoes",
  "observacoes_encerramento",
  "ocorrencias",
];

const DESPESA_FIELDS = [
  "tipo_gasto_id",
  "descricao",
  "valor",
  "registrado_em",
  "quantidade_combustivel",
  "km_registro",
];

const actorId = (actor) => {
  const n = Number(actor?.id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const pessoa = (u) => (u ? { id: u.id, nome: u.nome } : null);
const num = (v) => (v == null ? null : Number(v));

// ——— Apresentação ———

function presentViagem(v, totals, vis) {
  const t = totals?.get(v.id) || { total: 0, qtd: 0 };
  const ind = viagemIndicadores(v, t.total);
  return {
    id: v.id,
    numero: v.numero,
    status: v.status,
    caminhao: v.caminhoes
      ? { id: v.caminhoes.id, placa: v.caminhoes.placa, marca: v.caminhoes.marca, modelo: v.caminhoes.modelo }
      : { id: v.caminhao_id },
    motorista: v.motorista_id || v.motorista_nome
      ? { id: v.motorista_id, nome: v.motoristas?.nome ?? v.motorista_nome }
      : null,
    origem: v.origem,
    destino: v.destino,
    saida_em: v.saida_em,
    chegada_em: v.chegada_em,
    km_inicial: v.km_inicial,
    km_final: v.km_final,
    km_percorrido: ind.km_percorrido,
    duracao_min: ind.duracao_min,
    observacoes: v.observacoes,
    observacoes_encerramento: v.observacoes_encerramento,
    ocorrencias: v.ocorrencias,
    tem_ocorrencia: Boolean(v.ocorrencias && v.ocorrencias.trim()),
    motivo_cancelamento: v.motivo_cancelamento,
    criado_por: pessoa(v.criado_por_user),
    iniciado_por: pessoa(v.iniciado_por_user),
    encerrado_por: pessoa(v.encerrado_por_user),
    cancelado_por: pessoa(v.cancelado_por_user),
    criado_em: v.criado_em,
    iniciado_em: v.iniciado_em,
    encerrado_em: v.encerrado_em,
    cancelado_em: v.cancelado_em,
    atualizado_em: v.atualizado_em,
    qtd_despesas: vis.despesas ? t.qtd : null,
    total_despesas: vis.financeiro ? ind.total_despesas : null,
    custo_por_km: vis.financeiro ? ind.custo_por_km : null,
    financeiro_visivel: vis.financeiro,
  };
}

function presentDespesa(g, vis) {
  return {
    id: g.id,
    viagem_id: g.viagem_id,
    tipo_gasto_id: g.tipo_gasto_id,
    categoria: g.tipos_gastos?.nome_tipo ?? null,
    descricao: g.descricao,
    valor: vis.financeiro ? num(g.valor) : null,
    registrado_em: g.registrado_em ?? g.data_gasto,
    quantidade_combustivel: num(g.quantidade_combustivel),
    km_registro: g.km_registro,
    criado_por: pessoa(g.criado_por_user),
    tem_comprovante: Boolean(g.comprovante_path),
    comprovante_nome: g.comprovante_nome,
  };
}

function despesaSnapshot(g, categoria) {
  return {
    categoria: categoria ?? g.tipos_gastos?.nome_tipo ?? null,
    tipo_gasto_id: g.tipo_gasto_id,
    descricao: g.descricao,
    valor: num(g.valor),
    registrado_em: g.registrado_em ? new Date(g.registrado_em).toISOString() : null,
    quantidade_combustivel: num(g.quantidade_combustivel),
    km_registro: g.km_registro,
    comprovante_nome: g.comprovante_nome ?? null,
    comprovante_path: g.comprovante_path ?? null,
  };
}

async function despesaTotals(client, viagemIds) {
  const map = new Map();
  if (!viagemIds.length) return map;
  const rows = await client.gastos.groupBy({
    by: ["viagem_id"],
    where: { viagem_id: { in: viagemIds } },
    _sum: { valor: true },
    _count: { _all: true },
  });
  for (const r of rows) {
    map.set(r.viagem_id, { total: Number(r._sum.valor || 0), qtd: r._count._all });
  }
  return map;
}

async function historico(client, tenantId, viagemId, actor, acao, { alteracoes = null, motivo = null, despesaId = null } = {}) {
  await client.viagem_historico.create({
    data: {
      tenant_id: Number(tenantId),
      viagem_id: Number(viagemId),
      user_id: actorId(actor),
      user_nome: actor?.nome ? String(actor.nome).slice(0, 120) : actor?.email ? String(actor.email).slice(0, 120) : null,
      acao,
      despesa_id: despesaId,
      alteracoes: alteracoes ?? undefined,
      motivo: motivo || null,
    },
  });
}

// ——— Validações com banco ———

async function loadViagem(client, tenantId, id) {
  const v = await client.viagens.findFirst({
    where: { id: Number(id), tenant_id: Number(tenantId) },
    include: viagemInclude,
  });
  if (!v) throw httpError("Viagem não encontrada", 404, "VIAGEM_NAO_ENCONTRADA");
  return v;
}

async function assertCaminhao(client, tenantId, caminhaoId) {
  const c = await client.caminhoes.findFirst({
    where: { id: Number(caminhaoId), tenant_id: Number(tenantId) },
    select: { id: true, placa: true, tipo_veiculo: true, km_atual: true, empresa: true },
  });
  if (!c) throw httpError("Caminhão não encontrado", 400, "VIAGEM_CAMINHAO");
  if (c.tipo_veiculo === "carreta") {
    throw httpError("Carreta não faz viagem sozinha: escolha o cavalo ou o truck.", 400, "VIAGEM_CARRETA");
  }
  return c;
}

async function assertMotorista(client, tenantId, motoristaId) {
  const m = await client.motoristas.findFirst({
    where: { id: Number(motoristaId), tenant_id: Number(tenantId) },
    select: { id: true, nome: true, ativo: true },
  });
  if (!m) throw httpError("Motorista não encontrado", 400, "VIAGEM_MOTORISTA");
  if (!m.ativo) throw httpError("Motorista inativo não pode assumir viagem.", 400, "VIAGEM_MOTORISTA_INATIVO");
  return m;
}

async function assertLivreParaViagem(client, tenantId, { caminhaoId, motoristaId, exceptId = null }) {
  const notSelf = exceptId ? { id: { not: Number(exceptId) } } : {};
  if (caminhaoId) {
    const busy = await client.viagens.findFirst({
      where: { tenant_id: Number(tenantId), caminhao_id: Number(caminhaoId), status: "em_andamento", ...notSelf },
      select: { numero: true },
    });
    if (busy) {
      throw httpError(`Este caminhão já está na viagem nº ${busy.numero}, em andamento.`, 409, "VIAGEM_CAMINHAO_OCUPADO");
    }
  }
  if (motoristaId) {
    const busy = await client.viagens.findFirst({
      where: { tenant_id: Number(tenantId), motorista_id: Number(motoristaId), status: "em_andamento", ...notSelf },
      select: { numero: true },
    });
    if (busy) {
      throw httpError(`Este motorista já está na viagem nº ${busy.numero}, em andamento.`, 409, "VIAGEM_MOTORISTA_OCUPADO");
    }
  }
}

/** Corrida entre dois pedidos para o mesmo caminhão: o índice único parcial decide. */
function translateUniqueError(err) {
  if (err?.code === "P2002") {
    const target = JSON.stringify(err.meta || {});
    if (target.includes("em_andamento") || target.includes("caminhao_id")) {
      return httpError("Este caminhão já está em uma viagem em andamento.", 409, "VIAGEM_CAMINHAO_OCUPADO");
    }
  }
  return err;
}

async function nextNumero(tx, tenantId) {
  // Serializa a numeração por empresa (lock liberado no fim da transação).
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`viagens:${Number(tenantId)}`}))`;
  const agg = await tx.viagens.aggregate({ where: { tenant_id: Number(tenantId) }, _max: { numero: true } });
  return (agg._max.numero || 0) + 1;
}

// ——— Comprovante ———

async function storeComprovante(tenantId, viagemId, file) {
  if (!file?.buffer?.length) return null;
  ensureUploadDirs();
  const dir = viagemDocsDir(tenantId, viagemId);
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(file.originalname || "").toLowerCase() || ".pdf";
  const abs = path.join(dir, `${crypto.randomUUID()}${ext}`);
  await fs.writeFile(abs, file.buffer);
  const rel = path.relative(VIAGENS_ROOT, abs).split(path.sep).join("/");
  const stored = await ObjectStorage.putFile({
    key: `viagens/${rel}`,
    localPath: abs,
    contentType: file.mimetype,
  });
  return {
    comprovante_path: ObjectStorage.isS3Enabled() ? stored : rel,
    comprovante_nome: String(file.originalname || `comprovante${ext}`).slice(0, 255),
    comprovante_mime: String(file.mimetype || "application/octet-stream").slice(0, 100),
  };
}

// ——— Serviço ———

export class ViagemService {
  static async list(tenantId, actor, q) {
    const vis = viagemVisibility(actor.permissions);
    const where = { tenant_id: Number(tenantId) };
    if (q.status) where.status = Array.isArray(q.status) ? { in: q.status } : q.status;
    if (q.caminhao_id) where.caminhao_id = q.caminhao_id;
    if (q.motorista_id) where.motorista_id = q.motorista_id;
    if (q.de || q.ate) {
      where.saida_em = {};
      if (q.de) where.saida_em.gte = q.de;
      if (q.ate) where.saida_em.lte = q.ate;
    }
    if (q.origem) where.origem = { contains: q.origem, mode: "insensitive" };
    if (q.destino) where.destino = { contains: q.destino, mode: "insensitive" };
    if (q.com_ocorrencias) where.AND = [{ ocorrencias: { not: null } }, { NOT: { ocorrencias: "" } }];
    if (q.q) {
      const n = Number(q.q);
      where.OR = [
        { origem: { contains: q.q, mode: "insensitive" } },
        { destino: { contains: q.q, mode: "insensitive" } },
        { caminhoes: { placa: { contains: q.q.replace(/[^a-z0-9]/gi, ""), mode: "insensitive" } } },
        { motorista_nome: { contains: q.q, mode: "insensitive" } },
        ...(Number.isInteger(n) && n > 0 ? [{ numero: n }] : []),
      ];
    }
    const [rows, total] = await prisma.$transaction([
      prisma.viagens.findMany({
        where,
        include: viagemInclude,
        orderBy: [{ saida_em: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.viagens.count({ where }),
    ]);
    const totals = await despesaTotals(prisma, rows.map((r) => r.id));
    return {
      items: rows.map((r) => presentViagem(r, totals, vis)),
      total,
      page: q.page,
      limit: q.limit,
      financeiro_visivel: vis.financeiro,
    };
  }

  static async get(tenantId, actor, id) {
    const vis = viagemVisibility(actor.permissions);
    const v = await loadViagem(prisma, tenantId, id);
    const totals = await despesaTotals(prisma, [v.id]);
    const out = presentViagem(v, totals, vis);
    out.despesas = vis.despesas ? await this.listDespesas(tenantId, actor, v.id, { skipLoad: true }) : null;
    // Quanto cada categoria custou (somente com acesso financeiro e a despesas).
    if (vis.financeiro && vis.despesas) {
      const byCat = new Map();
      for (const d of out.despesas) {
        const k = d.categoria || "Outros";
        byCat.set(k, Math.round(((byCat.get(k) || 0) + (d.valor || 0)) * 100) / 100);
      }
      out.despesas_por_categoria = [...byCat.entries()]
        .map(([categoria, total]) => ({ categoria, total }))
        .sort((a, b) => b.total - a.total);
    }
    return out;
  }

  static async create(tenantId, actor, body) {
    assertPermission(actor.permissions, PERMISSIONS.VIAGENS_CREATE);
    if (body.iniciar) {
      assertPermission(actor.permissions, PERMISSIONS.VIAGENS_START, "Sem permissão para iniciar viagens. Salve como planejada.");
      assertNotFuture(body.saida_em, "A saída de uma viagem em andamento");
    }
    const caminhao = await assertCaminhao(prisma, tenantId, body.caminhao_id);
    const motorista = await assertMotorista(prisma, tenantId, body.motorista_id);
    if (body.iniciar) {
      await assertLivreParaViagem(prisma, tenantId, { caminhaoId: caminhao.id, motoristaId: motorista.id });
    }
    const uid = actorId(actor);
    const now = new Date();
    let created;
    try {
      created = await prisma.$transaction(async (tx) => {
        const numero = await nextNumero(tx, tenantId);
        const v = await tx.viagens.create({
          data: {
            tenant_id: Number(tenantId),
            numero,
            caminhao_id: caminhao.id,
            motorista_id: motorista.id,
            motorista_nome: motorista.nome,
            status: body.iniciar ? "em_andamento" : "planejada",
            origem: body.origem,
            destino: body.destino,
            saida_em: body.saida_em,
            km_inicial: body.km_inicial,
            observacoes: body.observacoes ?? null,
            criado_por: uid,
            iniciado_por: body.iniciar ? uid : null,
            iniciado_em: body.iniciar ? now : null,
          },
        });
        await historico(tx, tenantId, v.id, actor, "criada", {
          alteracoes: {
            caminhao: caminhao.placa,
            motorista: motorista.nome,
            origem: v.origem,
            destino: v.destino,
            saida_em: v.saida_em.toISOString(),
            km_inicial: v.km_inicial,
            status: v.status,
          },
        });
        if (body.iniciar) await historico(tx, tenantId, v.id, actor, "iniciada");
        if (body.iniciar) await syncKmFromRegistro(caminhao.id, body.km_inicial, { tx, tenantId });
        return v;
      });
    } catch (err) {
      throw translateUniqueError(err);
    }
    logger.info("Viagem criada", { tenantId, viagemId: created.id, numero: created.numero, by: uid });
    return this.get(tenantId, actor, created.id);
  }

  static async start(tenantId, actor, id, body = {}) {
    const v = await loadViagem(prisma, tenantId, id);
    if (v.status !== "planejada") {
      throw httpError("Só viagens planejadas podem ser iniciadas.", 409, "VIAGEM_STATUS");
    }
    const saida = body.saida_em ?? new Date();
    assertNotFuture(saida, "A saída");
    await assertLivreParaViagem(prisma, tenantId, { caminhaoId: v.caminhao_id, motoristaId: v.motorista_id, exceptId: v.id });
    const patch = {
      status: "em_andamento",
      saida_em: saida,
      km_inicial: body.km_inicial ?? v.km_inicial,
      iniciado_por: actorId(actor),
      iniciado_em: new Date(),
    };
    try {
      await prisma.$transaction(async (tx) => {
        const r = await tx.viagens.updateMany({ where: { id: v.id, tenant_id: Number(tenantId), status: "planejada" }, data: patch });
        if (r.count === 0) throw httpError("A viagem mudou de situação. Atualize a tela.", 409, "VIAGEM_STATUS");
        const alteracoes = diffFields(v, patch, ["saida_em", "km_inicial"]);
        await historico(tx, tenantId, v.id, actor, "iniciada", { alteracoes: Object.keys(alteracoes).length ? alteracoes : null });
        await syncKmFromRegistro(v.caminhao_id, patch.km_inicial, { tx, tenantId });
      });
    } catch (err) {
      throw translateUniqueError(err);
    }
    return this.get(tenantId, actor, v.id);
  }

  static async finish(tenantId, actor, id, body) {
    const v = await loadViagem(prisma, tenantId, id);
    if (v.status !== "em_andamento") {
      throw httpError("Só viagens em andamento podem ser encerradas.", 409, "VIAGEM_STATUS");
    }
    assertNotFuture(body.chegada_em, "A chegada");
    assertEncerramentoValido(v, body);
    const totals = await despesaTotals(prisma, [v.id]);
    await prisma.$transaction(async (tx) => {
      const r = await tx.viagens.updateMany({
        where: { id: v.id, tenant_id: Number(tenantId), status: "em_andamento" },
        data: {
          status: "finalizada",
          chegada_em: body.chegada_em,
          km_final: body.km_final,
          observacoes_encerramento: body.observacoes_encerramento ?? null,
          ocorrencias: body.ocorrencias ?? null,
          encerrado_por: actorId(actor),
          encerrado_em: new Date(),
        },
      });
      if (r.count === 0) throw httpError("A viagem mudou de situação. Atualize a tela.", 409, "VIAGEM_STATUS");
      const ind = viagemIndicadores({ ...v, status: "finalizada", ...body }, totals.get(v.id)?.total || 0);
      await historico(tx, tenantId, v.id, actor, "encerrada", {
        alteracoes: {
          chegada_em: new Date(body.chegada_em).toISOString(),
          km_final: body.km_final,
          km_percorrido: ind.km_percorrido,
          duracao_min: ind.duracao_min,
          total_despesas: ind.total_despesas,
          custo_por_km: ind.custo_por_km,
          ocorrencias: body.ocorrencias ?? null,
        },
      });
      await syncKmFromRegistro(v.caminhao_id, body.km_final, { tx, tenantId });
    });
    return this.get(tenantId, actor, v.id);
  }

  static async update(tenantId, actor, id, body) {
    const v = await loadViagem(prisma, tenantId, id);
    if (v.status === "cancelada") throw httpError("Viagem cancelada não pode ser alterada.", 409, "VIAGEM_STATUS");
    const { motivo, ...changes } = body;

    if (changes.caminhao_id != null && changes.caminhao_id !== v.caminhao_id && v.status !== "planejada") {
      throw httpError("O caminhão só pode ser trocado enquanto a viagem está planejada.", 409, "VIAGEM_TROCA_CAMINHAO");
    }
    const encerramento = ["chegada_em", "km_final", "observacoes_encerramento", "ocorrencias"];
    if (v.status !== "finalizada" && encerramento.some((f) => changes[f] !== undefined)) {
      throw httpError("Dados de chegada só podem ser editados em viagem finalizada.", 409, "VIAGEM_STATUS");
    }
    if (v.status === "finalizada" && !motivo) {
      throw httpError("Informe o motivo para alterar uma viagem já finalizada.", 400, "VIAGEM_MOTIVO");
    }

    const patch = {};
    const extra = {};
    if (changes.caminhao_id != null && changes.caminhao_id !== v.caminhao_id) {
      const c = await assertCaminhao(prisma, tenantId, changes.caminhao_id);
      patch.caminhao_id = c.id;
      extra.caminhao = { de: v.caminhoes?.placa ?? null, para: c.placa };
    }
    if (changes.motorista_id != null && changes.motorista_id !== v.motorista_id) {
      const m = await assertMotorista(prisma, tenantId, changes.motorista_id);
      if (v.status === "em_andamento") await assertLivreParaViagem(prisma, tenantId, { motoristaId: m.id, exceptId: v.id });
      patch.motorista_id = m.id;
      patch.motorista_nome = m.nome;
      extra.motorista = { de: v.motoristas?.nome ?? v.motorista_nome ?? null, para: m.nome };
    }
    for (const f of EDITABLE_FIELDS) {
      if (f === "caminhao_id" || f === "motorista_id") continue;
      if (changes[f] !== undefined) patch[f] = changes[f];
    }
    const merged = { ...v, ...patch };
    if (v.status !== "planejada" && patch.saida_em) assertNotFuture(patch.saida_em, "A saída");
    if (patch.chegada_em) assertNotFuture(patch.chegada_em, "A chegada");
    assertEncerramentoValido(merged, merged);

    const alteracoes = {
      ...diffFields(v, patch, EDITABLE_FIELDS.filter((f) => f !== "caminhao_id" && f !== "motorista_id")),
      ...extra,
    };
    if (!Object.keys(alteracoes).length) return this.get(tenantId, actor, v.id);

    await prisma.$transaction(async (tx) => {
      await tx.viagens.updateMany({ where: { id: v.id, tenant_id: Number(tenantId) }, data: patch });
      await historico(tx, tenantId, v.id, actor, "editada", { alteracoes, motivo });
      if (patch.km_final != null) await syncKmFromRegistro(merged.caminhao_id, patch.km_final, { tx, tenantId });
    });
    return this.get(tenantId, actor, v.id);
  }

  static async cancel(tenantId, actor, id, { motivo }) {
    const v = await loadViagem(prisma, tenantId, id);
    if (!["planejada", "em_andamento"].includes(v.status)) {
      throw httpError("Só viagens planejadas ou em andamento podem ser canceladas.", 409, "VIAGEM_STATUS");
    }
    await prisma.$transaction(async (tx) => {
      const r = await tx.viagens.updateMany({
        where: { id: v.id, tenant_id: Number(tenantId), status: v.status },
        data: { status: "cancelada", motivo_cancelamento: motivo, cancelado_por: actorId(actor), cancelado_em: new Date() },
      });
      if (r.count === 0) throw httpError("A viagem mudou de situação. Atualize a tela.", 409, "VIAGEM_STATUS");
      await historico(tx, tenantId, v.id, actor, "cancelada", { motivo, alteracoes: { status: { de: v.status, para: "cancelada" } } });
    });
    return this.get(tenantId, actor, v.id);
  }

  static async historico(tenantId, actor, id) {
    const vis = viagemVisibility(actor.permissions);
    await loadViagem(prisma, tenantId, id);
    const rows = await prisma.viagem_historico.findMany({
      where: { tenant_id: Number(tenantId), viagem_id: Number(id) },
      orderBy: [{ criado_em: "desc" }, { id: "desc" }],
      take: 500,
    });
    return rows.map((r) => presentHistorico(r, vis));
  }

  // ——— Despesas ———

  static async listDespesas(tenantId, actor, viagemId, { skipLoad = false } = {}) {
    const vis = viagemVisibility(actor.permissions);
    if (!skipLoad) await loadViagem(prisma, tenantId, viagemId);
    const rows = await prisma.gastos.findMany({
      where: { tenant_id: Number(tenantId), viagem_id: Number(viagemId) },
      include: despesaInclude,
      orderBy: [{ registrado_em: "desc" }, { id: "desc" }],
    });
    return rows.map((g) => presentDespesa(g, vis));
  }

  static async createDespesa(tenantId, actor, viagemId, body, file) {
    const v = await loadViagem(prisma, tenantId, viagemId);
    if (!["em_andamento", "finalizada"].includes(v.status)) {
      throw httpError("Despesas só podem ser lançadas em viagem em andamento ou finalizada.", 409, "VIAGEM_STATUS");
    }
    assertDespesaNoPeriodo(v, body.registrado_em);
    const tipo = await assertTipoGasto(body.tipo_gasto_id);
    const caminhao = await prisma.caminhoes.findFirst({
      where: { id: v.caminhao_id, tenant_id: Number(tenantId) },
      select: { empresa: true },
    });
    const comprovante = await storeComprovante(tenantId, v.id, file);
    const created = await prisma.$transaction(async (tx) => {
      const g = await tx.gastos.create({
        data: {
          tenant_id: Number(tenantId),
          viagem_id: v.id,
          caminhao_id: v.caminhao_id,
          motorista_id: v.motorista_id,
          tipo_gasto_id: tipo.id,
          descricao: body.descricao,
          valor: body.valor,
          data_gasto: new Date(`${dataLocalBrasil(body.registrado_em)}T00:00:00.000Z`),
          registrado_em: body.registrado_em,
          quantidade_combustivel: body.quantidade_combustivel ?? null,
          km_registro: body.km_registro ?? null,
          empresa: caminhao?.empresa ?? null,
          criado_por: actorId(actor),
          ...(comprovante || {}),
        },
        include: despesaInclude,
      });
      await historico(tx, tenantId, v.id, actor, "despesa_registrada", {
        despesaId: g.id,
        alteracoes: despesaSnapshot(g, tipo.nome_tipo),
      });
      if (body.km_registro != null) await syncKmFromRegistro(v.caminhao_id, body.km_registro, { tx, tenantId });
      return g;
    });
    return presentDespesa(created, viagemVisibility(actor.permissions));
  }

  static async updateDespesa(tenantId, actor, viagemId, despesaId, body, file) {
    const v = await loadViagem(prisma, tenantId, viagemId);
    if (v.status === "cancelada") throw httpError("Viagem cancelada não pode ser alterada.", 409, "VIAGEM_STATUS");
    const g = await loadDespesa(tenantId, v.id, despesaId);
    const { motivo, ...changes } = body;
    if (changes.registrado_em) assertDespesaNoPeriodo(v, changes.registrado_em);
    let categoria = g.tipos_gastos?.nome_tipo ?? null;
    if (changes.tipo_gasto_id && changes.tipo_gasto_id !== g.tipo_gasto_id) {
      categoria = (await assertTipoGasto(changes.tipo_gasto_id)).nome_tipo;
    }
    const patch = {};
    for (const f of DESPESA_FIELDS) if (changes[f] !== undefined) patch[f] = changes[f];
    if (patch.registrado_em) patch.data_gasto = new Date(`${dataLocalBrasil(patch.registrado_em)}T00:00:00.000Z`);
    const alteracoes = diffFields(g, patch, DESPESA_FIELDS);
    if (alteracoes.tipo_gasto_id) alteracoes.categoria = { de: g.tipos_gastos?.nome_tipo ?? null, para: categoria };
    const comprovante = await storeComprovante(tenantId, v.id, file);
    if (comprovante) {
      Object.assign(patch, comprovante);
      alteracoes.comprovante = { de: g.comprovante_nome ?? null, para: comprovante.comprovante_nome };
    }
    if (!Object.keys(alteracoes).length) return presentDespesa(g, viagemVisibility(actor.permissions));
    const updated = await prisma.$transaction(async (tx) => {
      await tx.gastos.updateMany({ where: { id: g.id, tenant_id: Number(tenantId), viagem_id: v.id }, data: patch });
      await historico(tx, tenantId, v.id, actor, "despesa_editada", { despesaId: g.id, alteracoes, motivo });
      if (patch.km_registro != null) await syncKmFromRegistro(v.caminhao_id, patch.km_registro, { tx, tenantId });
      return tx.gastos.findFirst({ where: { id: g.id }, include: despesaInclude });
    });
    return presentDespesa(updated, viagemVisibility(actor.permissions));
  }

  /**
   * Exclusão com auditoria: exige motivo e guarda o retrato completo da
   * despesa (e o caminho do comprovante, que não é apagado) no histórico.
   */
  static async deleteDespesa(tenantId, actor, viagemId, despesaId, { motivo }) {
    const v = await loadViagem(prisma, tenantId, viagemId);
    const g = await loadDespesa(tenantId, v.id, despesaId);
    await prisma.$transaction(async (tx) => {
      await historico(tx, tenantId, v.id, actor, "despesa_excluida", {
        despesaId: g.id,
        alteracoes: despesaSnapshot(g),
        motivo,
      });
      await tx.gastos.deleteMany({ where: { id: g.id, tenant_id: Number(tenantId), viagem_id: v.id } });
    });
    logger.info("Despesa de viagem excluída", { tenantId, viagemId: v.id, despesaId: g.id, by: actorId(actor) });
    return { deleted: true };
  }

  static async comprovante(tenantId, viagemId, despesaId) {
    const v = await loadViagem(prisma, tenantId, viagemId);
    const g = await loadDespesa(tenantId, v.id, despesaId);
    if (!g.comprovante_path) throw httpError("Esta despesa não tem comprovante.", 404, "SEM_COMPROVANTE");
    const toAbs = (rel) => resolverPathNaRaiz(VIAGENS_ROOT, rel, "Comprovante não encontrado");
    if (!(await ObjectStorage.exists(g.comprovante_path, toAbs))) {
      throw httpError("Arquivo do comprovante não encontrado.", 404, "SEM_COMPROVANTE");
    }
    const stream = g.comprovante_path.startsWith("s3://")
      ? await ObjectStorage.openReadable(g.comprovante_path)
      : await ObjectStorage.openReadable(toAbs(g.comprovante_path));
    return { stream, nome: g.comprovante_nome || "comprovante", mime: g.comprovante_mime || "application/octet-stream" };
  }

  // ——— Painel e relatório ———

  static async resumo(tenantId, actor, q) {
    const vis = viagemVisibility(actor.permissions);
    const tid = Number(tenantId);
    const ate = q.ate ?? new Date();
    const de = q.de ?? new Date(ate.getTime() - 30 * 86_400_000);
    const scope = {
      tenant_id: tid,
      ...(q.caminhao_id ? { caminhao_id: q.caminhao_id } : {}),
      ...(q.motorista_id ? { motorista_id: q.motorista_id } : {}),
    };
    const [andamento, finalizadas, planejadas, canceladas, recentes] = await Promise.all([
      prisma.viagens.findMany({
        where: { ...scope, status: "em_andamento" },
        include: viagemInclude,
        orderBy: { saida_em: "asc" },
        take: 200,
      }),
      prisma.viagens.findMany({
        where: { ...scope, status: "finalizada", chegada_em: { gte: de, lte: ate } },
        select: { id: true, km_inicial: true, km_final: true, ocorrencias: true, saida_em: true, chegada_em: true },
        take: 10_000,
      }),
      prisma.viagens.count({ where: { ...scope, status: "planejada" } }),
      prisma.viagens.count({ where: { ...scope, status: "cancelada", cancelado_em: { gte: de, lte: ate } } }),
      prisma.viagem_historico.findMany({
        where: {
          tenant_id: tid,
          ...(q.caminhao_id || q.motorista_id ? { viagens: scope } : {}),
        },
        orderBy: [{ criado_em: "desc" }, { id: "desc" }],
        take: 15,
        include: { viagens: { select: { numero: true, caminhoes: { select: { placa: true } } } } },
      }),
    ]);
    const kmPercorrido = finalizadas.reduce((s, v) => s + Math.max(0, (v.km_final ?? v.km_inicial) - v.km_inicial), 0);
    const comOcorrencias = finalizadas.filter((v) => v.ocorrencias && v.ocorrencias.trim()).length;
    const andamentoTotals = await despesaTotals(prisma, andamento.map((v) => v.id));

    const out = {
      periodo: { de, ate },
      em_andamento: andamento.length,
      planejadas,
      finalizadas: finalizadas.length,
      canceladas,
      com_ocorrencias: comOcorrencias,
      km_percorrido: kmPercorrido,
      caminhoes_em_viagem: andamento.map((v) => presentViagem(v, andamentoTotals, vis)),
      ultimas_operacoes: recentes
        .map((r) => ({
          ...presentHistorico(r, vis),
          viagem_numero: r.viagens?.numero ?? null,
          placa: r.viagens?.caminhoes?.placa ?? null,
        })),
      financeiro_visivel: vis.financeiro,
      total_despesas: null,
      custo_por_km: null,
    };
    if (vis.financeiro) {
      // Despesas lançadas no período (todas as viagens) e custo/km das finalizadas.
      const [noPeriodo, dasFinalizadas] = await Promise.all([
        prisma.gastos.aggregate({
          where: { tenant_id: tid, viagem_id: { not: null }, registrado_em: { gte: de, lte: ate }, viagens: scope },
          _sum: { valor: true },
        }),
        finalizadas.length
          ? prisma.gastos.aggregate({ where: { viagem_id: { in: finalizadas.map((v) => v.id) } }, _sum: { valor: true } })
          : Promise.resolve({ _sum: { valor: 0 } }),
      ]);
      out.total_despesas = Math.round(Number(noPeriodo._sum.valor || 0) * 100) / 100;
      const custoFinalizadas = Number(dasFinalizadas._sum.valor || 0);
      out.custo_por_km = kmPercorrido > 0 ? Math.round((custoFinalizadas / kmPercorrido) * 1000) / 1000 : null;
    }
    return out;
  }

  /** Viagens finalizadas no período agrupadas por caminhão, por motorista e (financeiro) por categoria. */
  static async relatorio(tenantId, actor, q) {
    const vis = viagemVisibility(actor.permissions);
    const tid = Number(tenantId);
    const ate = q.ate ?? new Date();
    const de = q.de ?? new Date(ate.getTime() - 30 * 86_400_000);
    const where = {
      tenant_id: tid,
      status: "finalizada",
      chegada_em: { gte: de, lte: ate },
      ...(q.caminhao_id ? { caminhao_id: q.caminhao_id } : {}),
      ...(q.motorista_id ? { motorista_id: q.motorista_id } : {}),
    };
    const viagens = await prisma.viagens.findMany({
      where,
      select: {
        id: true,
        caminhao_id: true,
        motorista_id: true,
        motorista_nome: true,
        km_inicial: true,
        km_final: true,
        saida_em: true,
        chegada_em: true,
        ocorrencias: true,
        caminhoes: { select: { placa: true } },
        motoristas: { select: { nome: true } },
      },
      take: 20_000,
    });
    const totals = vis.financeiro ? await despesaTotals(prisma, viagens.map((v) => v.id)) : new Map();
    const group = (keyFn, labelFn) => {
      const m = new Map();
      for (const v of viagens) {
        const k = keyFn(v);
        const row = m.get(k) || { id: k, nome: labelFn(v), viagens: 0, km: 0, horas: 0, ocorrencias: 0, total_despesas: 0 };
        row.viagens += 1;
        row.km += Math.max(0, (v.km_final ?? v.km_inicial) - v.km_inicial);
        row.horas += Math.max(0, (new Date(v.chegada_em) - new Date(v.saida_em)) / 3_600_000);
        if (v.ocorrencias && v.ocorrencias.trim()) row.ocorrencias += 1;
        row.total_despesas += totals.get(v.id)?.total || 0;
        m.set(k, row);
      }
      return [...m.values()]
        .map((r) => ({
          ...r,
          horas: Math.round(r.horas * 10) / 10,
          total_despesas: vis.financeiro ? Math.round(r.total_despesas * 100) / 100 : null,
          custo_por_km: vis.financeiro && r.km > 0 ? Math.round((r.total_despesas / r.km) * 1000) / 1000 : null,
        }))
        .sort((a, b) => b.km - a.km);
    };
    const out = {
      periodo: { de, ate },
      financeiro_visivel: vis.financeiro,
      por_caminhao: group((v) => v.caminhao_id, (v) => v.caminhoes?.placa ?? `#${v.caminhao_id}`),
      por_motorista: group((v) => v.motorista_id ?? `nome:${v.motorista_nome}`, (v) => v.motoristas?.nome ?? v.motorista_nome ?? "—"),
      por_categoria: null,
    };
    if (vis.financeiro && viagens.length) {
      const rows = await prisma.gastos.groupBy({
        by: ["tipo_gasto_id"],
        where: { viagem_id: { in: viagens.map((v) => v.id) } },
        _sum: { valor: true },
        _count: { _all: true },
      });
      const tipos = await prisma.tipos_gastos.findMany({
        where: { id: { in: rows.map((r) => r.tipo_gasto_id).filter(Boolean) } },
        select: { id: true, nome_tipo: true },
      });
      const nome = new Map(tipos.map((t) => [t.id, t.nome_tipo]));
      out.por_categoria = rows
        .map((r) => ({
          categoria: nome.get(r.tipo_gasto_id) || "Outros",
          quantidade: r._count._all,
          total: Math.round(Number(r._sum.valor || 0) * 100) / 100,
        }))
        .sort((a, b) => b.total - a.total);
    }
    return out;
  }
}

function presentHistorico(r, vis) {
  const alteracoes = sanitizeHistoricoAlteracoes(r, vis);
  const hideDespesa = String(r.acao).startsWith("despesa_") && !vis.despesas;
  const alt = alteracoes && typeof alteracoes === "object" ? { ...alteracoes } : alteracoes;
  if (alt && typeof alt === "object") delete alt.comprovante_path;
  return {
    id: Number(r.id),
    viagem_id: r.viagem_id,
    acao: r.acao,
    usuario: r.user_id || r.user_nome ? { id: r.user_id, nome: r.user_nome } : null,
    despesa_id: hideDespesa ? null : r.despesa_id,
    alteracoes: hideDespesa ? null : alt,
    motivo: hideDespesa ? null : r.motivo,
    criado_em: r.criado_em,
  };
}

async function loadDespesa(tenantId, viagemId, despesaId) {
  const g = await prisma.gastos.findFirst({
    where: { id: Number(despesaId), tenant_id: Number(tenantId), viagem_id: Number(viagemId) },
    include: despesaInclude,
  });
  if (!g) throw httpError("Despesa não encontrada", 404, "DESPESA_NAO_ENCONTRADA");
  return g;
}

async function assertTipoGasto(tipoId) {
  const t = await prisma.tipos_gastos.findUnique({ where: { id: Number(tipoId) }, select: { id: true, nome_tipo: true } });
  if (!t) throw httpError("Categoria de despesa não encontrada", 400, "DESPESA_CATEGORIA");
  return t;
}

function assertDespesaNoPeriodo(v, registradoEm) {
  const t = new Date(registradoEm).getTime();
  assertNotFuture(registradoEm, "A data da despesa");
  if (t < new Date(v.saida_em).getTime() - DESPESA_ANTES_SAIDA_MS) {
    throw httpError("A despesa é de mais de um dia antes da saída da viagem.", 400, "DESPESA_FORA_DO_PERIODO");
  }
}
