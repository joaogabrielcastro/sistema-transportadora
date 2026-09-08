import { rmSync } from "node:fs";
import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
import { CiotProviderClient } from "../../src/services/fiscal/CiotProviderClient.js";
import {
  createSecondaryTenantAdmin,
  loginWithCredentials,
  cleanupTenant,
} from "../helpers/dbTestFixtures.js";

const skip = shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI";

const FISCAL_FEATURES = {
  ordem_coleta: true,
  notas_estoque: false,
  transporte_fiscal: true,
};

const CHAVE_NFE_TESTE = "35240000000000000000000000000000000000000000";
const JUSTIFICATIVA = "Cancelamento de teste de concorrencia";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function payloadCteRascunho(clienteId, extras = {}) {
  return {
    cliente_id: clienteId,
    tipo_cte: "0",
    cfop: "6353",
    natureza_operacao: "Transporte",
    dt_emissao: new Date().toISOString(),
    servico: { valor_prestacao: 150 },
    tomador: { cpf_cnpj: "12345678000195" },
    chave_nfe_referenciada: CHAVE_NFE_TESTE,
    ...extras,
  };
}

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  };
}

function urlOf(input) {
  if (typeof input === "string") return input;
  if (input && typeof input.url === "string") return input.url;
  return String(input);
}

async function cleanupFiscal(tenantId) {
  if (!tenantId) return;
  await prisma.fiscal_ctes.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.fiscal_mdfes.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.fiscal_ciots.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.fiscal_contratos_frete.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.fiscal_clientes.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.fiscal_empresas.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
}

async function setupTenant() {
  process.env.FISCAL_SECRETS_KEY =
    process.env.FISCAL_SECRETS_KEY || "integration-fiscal-secrets-key";
  const secondary = await createSecondaryTenantAdmin({
    slug: `uni-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    email: `uni-${Date.now().toString(36)}@tenant.local`,
    features: FISCAL_FEATURES,
  });
  const { authHeader } = await loginWithCredentials(
    app,
    secondary.email,
    secondary.password,
  );
  const empresa = await request(app)
    .post("/api/fiscal/empresas")
    .set(authHeader)
    .send({
      cnpj: "12345678000195",
      razao_social: "Emissora Unicidade",
      crt: 1,
      cte_mdfe_provider_token: "token-empresa-unicidade",
      certificado_senha: "senha-teste-ciot",
    });
  assert.equal(empresa.status, 201, empresa.body?.error);
  const cliente = await request(app)
    .post("/api/fiscal/clientes")
    .set(authHeader)
    .send({ razao_social: "Tomador Unicidade", cnpj_cpf: "12345678000195" });
  assert.equal(cliente.status, 201, cliente.body?.error);
  return {
    tenantId: secondary.tenant.id,
    secondary,
    authHeader,
    empresaId: empresa.body.data.id,
    clienteId: cliente.body.data.id,
  };
}

test.after(() => {
  if (process.env.UPLOADS_DIR) {
    rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  }
});

test(
  "PostgreSQL: índices parciais de unicidade fiscal existem",
  { skip },
  async () => {
    const rows = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'fiscal_ctes_brasil_nfe_id_key',
          'fiscal_mdfes_brasil_nfe_id_key',
          'fiscal_ctes_empresa_serie_numero_ambiente_key',
          'fiscal_mdfes_empresa_serie_numero_ambiente_key'
        )
      ORDER BY indexname
    `;
    const names = rows.map((r) => r.indexname);
    for (const expected of [
      "fiscal_ctes_brasil_nfe_id_key",
      "fiscal_mdfes_brasil_nfe_id_key",
      "fiscal_ctes_empresa_serie_numero_ambiente_key",
      "fiscal_mdfes_empresa_serie_numero_ambiente_key",
    ]) {
      assert.ok(names.includes(expected), `índice ausente: ${expected}`);
    }
    const serieCte = rows.find(
      (r) => r.indexname === "fiscal_ctes_empresa_serie_numero_ambiente_key",
    );
    assert.match(String(serieCte.indexdef), /UNIQUE/i);
    assert.match(String(serieCte.indexdef), /numero IS NOT NULL/i);
  },
);

test(
  "PostgreSQL: recusa duplicata de brasil_nfe_id e de série+número (CT-e e MDF-e)",
  { skip },
  async () => {
    const ctx = await setupTenant();
    try {
      const stamp = Date.now().toString(36);
      await prisma.fiscal_ctes.create({
        data: {
          tenant_id: ctx.tenantId,
          cliente_id: ctx.clienteId,
          fiscal_empresa_id: ctx.empresaId,
          status: "processado",
          ambiente: 2,
          serie: "1",
          numero: `U${stamp}`,
          brasil_nfe_id: `cte-dup-${stamp}`,
        },
      });
      await assert.rejects(
        () =>
          prisma.fiscal_ctes.create({
            data: {
              tenant_id: ctx.tenantId,
              cliente_id: ctx.clienteId,
              fiscal_empresa_id: ctx.empresaId,
              status: "rascunho",
              brasil_nfe_id: `cte-dup-${stamp}`,
            },
          }),
        /Unique constraint|unique|P2002/i,
      );
      await assert.rejects(
        () =>
          prisma.fiscal_ctes.create({
            data: {
              tenant_id: ctx.tenantId,
              cliente_id: ctx.clienteId,
              fiscal_empresa_id: ctx.empresaId,
              status: "processado",
              ambiente: 2,
              serie: "1",
              numero: `U${stamp}`,
            },
          }),
        /Unique constraint|unique|P2002/i,
      );

      await prisma.fiscal_mdfes.create({
        data: {
          tenant_id: ctx.tenantId,
          fiscal_empresa_id: ctx.empresaId,
          status: "processado",
          ambiente: 2,
          serie: "1",
          numero: `M${stamp}`,
          brasil_nfe_id: `mdfe-dup-${stamp}`,
        },
      });
      await assert.rejects(
        () =>
          prisma.fiscal_mdfes.create({
            data: {
              tenant_id: ctx.tenantId,
              fiscal_empresa_id: ctx.empresaId,
              status: "rascunho",
              brasil_nfe_id: `mdfe-dup-${stamp}`,
            },
          }),
        /Unique constraint|unique|P2002/i,
      );
      await assert.rejects(
        () =>
          prisma.fiscal_mdfes.create({
            data: {
              tenant_id: ctx.tenantId,
              fiscal_empresa_id: ctx.empresaId,
              status: "processado",
              ambiente: 2,
              serie: "1",
              numero: `M${stamp}`,
            },
          }),
        /Unique constraint|unique|P2002/i,
      );

      const attempts = await Promise.allSettled([
        prisma.fiscal_ctes.create({
          data: {
            tenant_id: ctx.tenantId,
            cliente_id: ctx.clienteId,
            brasil_nfe_id: `cte-race-${stamp}`,
            status: "processando",
          },
        }),
        prisma.fiscal_ctes.create({
          data: {
            tenant_id: ctx.tenantId,
            cliente_id: ctx.clienteId,
            brasil_nfe_id: `cte-race-${stamp}`,
            status: "processando",
          },
        }),
      ]);
      const ok = attempts.filter((r) => r.status === "fulfilled");
      const fail = attempts.filter((r) => r.status === "rejected");
      assert.equal(ok.length, 1, "só uma inserção de brasil_nfe_id pode vencer");
      assert.equal(fail.length, 1);
    } finally {
      await cleanupFiscal(ctx.tenantId);
      await cleanupTenant(ctx.tenantId);
    }
  },
);

test(
  "concorrência real: duas emissões do mesmo CT-e — um POST, segunda consulta",
  { skip },
  async () => {
    const ctx = await setupTenant();
    const originalFetch = globalThis.fetch;
    const counts = { emitir: 0, consultar: 0 };
    const chave = `3526${Date.now()}`.padEnd(44, "1").slice(0, 44);
    try {
      const draft = await request(app)
        .post("/api/fiscal/cte")
        .set(ctx.authHeader)
        .send(payloadCteRascunho(ctx.clienteId, { fiscal_empresa_id: ctx.empresaId }));
      assert.equal(draft.status, 201, draft.body?.error);
      const cteId = draft.body.data.id;

      globalThis.fetch = async (input) => {
        const url = urlOf(input);
        if (url.includes("EnviarConhecimentoTransporte")) {
          counts.emitir += 1;
          await sleep(250);
          return jsonResponse({
            status: 0,
            chave,
            numero: 10,
            serie: 1,
            NuProtocolo: "900010",
          });
        }
        if (url.includes("ObterNotasFiscais")) {
          counts.consultar += 1;
          return jsonResponse({
            Notas: [
              {
                chave,
                status: 0,
                Situacao: "autorizado",
                IdentificadorInterno: `cte-${cteId}`,
                numero: 10,
                serie: 1,
              },
            ],
          });
        }
        if (url.includes("ObterArquivoNotaFiscal")) {
          return jsonResponse({});
        }
        throw new Error(`URL inesperada na emissão CT-e: ${url}`);
      };

      const [a, b] = await Promise.all([
        request(app).post(`/api/fiscal/cte/${cteId}/emitir`).set(ctx.authHeader),
        request(app).post(`/api/fiscal/cte/${cteId}/emitir`).set(ctx.authHeader),
      ]);
      assert.equal(counts.emitir, 1, "segunda emissão não pode POST na Brasil NFe");
      assert.ok(
        [a.status, b.status].every((s) => [200, 201, 409].includes(s)),
        `statuses inesperados: ${a.status}/${b.status} ${a.body?.error || ""} ${b.body?.error || ""}`,
      );
      const got = await request(app)
        .get(`/api/fiscal/cte/${cteId}`)
        .set(ctx.authHeader);
      assert.equal(got.body.data.status, "processado");
      assert.equal(got.body.data.chave_acesso, chave);
    } finally {
      globalThis.fetch = originalFetch;
      await cleanupFiscal(ctx.tenantId);
      await cleanupTenant(ctx.tenantId);
    }
  },
);

test(
  "recuperação: processando + brasil_nfe_id consulta e não reemite",
  { skip },
  async () => {
    const ctx = await setupTenant();
    const originalFetch = globalThis.fetch;
    const counts = { emitir: 0, consultar: 0 };
    const chave = `3526${Date.now()}`.padEnd(44, "2").slice(0, 44);
    try {
      const draft = await request(app)
        .post("/api/fiscal/cte")
        .set(ctx.authHeader)
        .send(payloadCteRascunho(ctx.clienteId, { fiscal_empresa_id: ctx.empresaId }));
      assert.equal(draft.status, 201, draft.body?.error);
      const cteId = draft.body.data.id;
      await prisma.fiscal_ctes.update({
        where: { id: cteId },
        data: {
          status: "processando",
          brasil_nfe_id: `cte-${cteId}`,
          fiscal_empresa_id: ctx.empresaId,
          emissao_iniciada_em: new Date(),
        },
      });

      globalThis.fetch = async (input) => {
        const url = urlOf(input);
        if (url.includes("EnviarConhecimentoTransporte")) {
          counts.emitir += 1;
          throw new Error("POST de emissão não deveria ocorrer na recuperação");
        }
        if (url.includes("ObterNotasFiscais")) {
          counts.consultar += 1;
          return jsonResponse({
            Notas: [
              {
                chave,
                status: 0,
                Situacao: "autorizado",
                IdentificadorInterno: `cte-${cteId}`,
                numero: 22,
                serie: 1,
                NuProtocolo: "900022",
              },
            ],
          });
        }
        if (url.includes("ObterArquivoNotaFiscal")) {
          return jsonResponse({});
        }
        throw new Error(`URL inesperada na recuperação: ${url}`);
      };

      const recovered = await request(app)
        .post(`/api/fiscal/cte/${cteId}/emitir`)
        .set(ctx.authHeader);
      assert.ok(
        [200, 201].includes(recovered.status),
        recovered.body?.error || String(recovered.status),
      );
      assert.equal(counts.emitir, 0, "recuperação não pode gerar segundo POST");
      assert.ok(counts.consultar >= 1);
      assert.equal(recovered.body.data.status, "processado");
      assert.equal(recovered.body.data.chave_acesso, chave);
    } finally {
      globalThis.fetch = originalFetch;
      await cleanupFiscal(ctx.tenantId);
      await cleanupTenant(ctx.tenantId);
    }
  },
);

test(
  "concorrência real: duas emissões do mesmo MDF-e — um POST",
  { skip },
  async () => {
    const ctx = await setupTenant();
    const originalFetch = globalThis.fetch;
    const counts = { cte: 0, mdfe: 0, consultar: 0 };
    const chaveCte = `3526${Date.now()}`.padEnd(44, "3").slice(0, 44);
    const chaveMdfe = `5826${Date.now()}`.padEnd(44, "4").slice(0, 44);
    try {
      globalThis.fetch = async (input) => {
        const url = urlOf(input);
        if (url.includes("EnviarConhecimentoTransporte")) {
          counts.cte += 1;
          return jsonResponse({
            status: 0,
            chave: chaveCte,
            numero: 30,
            serie: 1,
            NuProtocolo: "900030",
          });
        }
        if (url.includes("EnviarManifestoTransporte")) {
          counts.mdfe += 1;
          await sleep(250);
          return jsonResponse({
            status: 0,
            chave: chaveMdfe,
            numero: 40,
            serie: 1,
            NuProtocolo: "900040",
          });
        }
        if (url.includes("ObterNotasFiscais")) {
          counts.consultar += 1;
          return jsonResponse({
            Notas: [
              {
                chave: chaveMdfe,
                status: 0,
                Situacao: "autorizado",
                numero: 40,
                serie: 1,
              },
            ],
          });
        }
        if (url.includes("ObterArquivoNotaFiscal")) {
          return jsonResponse({});
        }
        throw new Error(`URL inesperada no MDF-e: ${url}`);
      };

      const cteDraft = await request(app)
        .post("/api/fiscal/cte")
        .set(ctx.authHeader)
        .send(payloadCteRascunho(ctx.clienteId, { fiscal_empresa_id: ctx.empresaId }));
      assert.equal(cteDraft.status, 201, cteDraft.body?.error);
      const cteEmit = await request(app)
        .post(`/api/fiscal/cte/${cteDraft.body.data.id}/emitir`)
        .set(ctx.authHeader);
      assert.equal(cteEmit.status, 201, cteEmit.body?.error);

      const mdfeDraft = await request(app)
        .post("/api/fiscal/mdfe")
        .set(ctx.authHeader)
        .send({
          fiscal_empresa_id: ctx.empresaId,
          uf_carregamento: "SP",
          uf_descarregamento: "RJ",
          data_emissao: new Date().toISOString(),
          rodoviario: {
            placa: "ABC1D23",
            condutores: [{ nome: "Joao Motorista", cpf: "12345678909" }],
          },
          cte_ids: [cteDraft.body.data.id],
          resp_seg: 1,
          numero_apolice: "AP-UNI-1",
        });
      assert.equal(mdfeDraft.status, 201, mdfeDraft.body?.error);
      const mdfeId = mdfeDraft.body.data.id;

      const [a, b] = await Promise.all([
        request(app).post(`/api/fiscal/mdfe/${mdfeId}/emitir`).set(ctx.authHeader),
        request(app).post(`/api/fiscal/mdfe/${mdfeId}/emitir`).set(ctx.authHeader),
      ]);
      assert.equal(counts.mdfe, 1, "segunda emissão de MDF-e não pode POST");
      assert.ok(
        [a.status, b.status].every((s) => [200, 201, 409].includes(s)),
        `statuses MDF-e: ${a.status}/${b.status} ${a.body?.error || ""} ${b.body?.error || ""}`,
      );
      const got = await request(app)
        .get(`/api/fiscal/mdfe/${mdfeId}`)
        .set(ctx.authHeader);
      assert.equal(got.body.data.status, "processado");
    } finally {
      globalThis.fetch = originalFetch;
      await cleanupFiscal(ctx.tenantId);
      await cleanupTenant(ctx.tenantId);
    }
  },
);

test(
  "concorrência real: dois cancelamentos do mesmo CT-e — um avança, o outro 409 ou idempotente",
  { skip },
  async () => {
    const ctx = await setupTenant();
    const originalFetch = globalThis.fetch;
    const counts = { emitir: 0, cancelar: 0 };
    const chave = `3526${Date.now()}`.padEnd(44, "5").slice(0, 44);
    try {
      globalThis.fetch = async (input) => {
        const url = urlOf(input);
        if (url.includes("EnviarConhecimentoTransporte")) {
          counts.emitir += 1;
          return jsonResponse({
            status: 0,
            chave,
            numero: 50,
            serie: 1,
            NuProtocolo: "900050",
          });
        }
        if (url.includes("CancelarNotaFiscal")) {
          counts.cancelar += 1;
          await sleep(250);
          return jsonResponse({ status: 1, DsMotivo: "Evento autorizado" });
        }
        throw new Error(`URL inesperada no cancelamento: ${url}`);
      };

      const draft = await request(app)
        .post("/api/fiscal/cte")
        .set(ctx.authHeader)
        .send(payloadCteRascunho(ctx.clienteId, { fiscal_empresa_id: ctx.empresaId }));
      assert.equal(draft.status, 201, draft.body?.error);
      const emit = await request(app)
        .post(`/api/fiscal/cte/${draft.body.data.id}/emitir`)
        .set(ctx.authHeader);
      assert.equal(emit.status, 201, emit.body?.error);

      const [a, b] = await Promise.all([
        request(app)
          .post(`/api/fiscal/cte/${draft.body.data.id}/cancelar`)
          .set(ctx.authHeader)
          .send({ justificativa: JUSTIFICATIVA }),
        request(app)
          .post(`/api/fiscal/cte/${draft.body.data.id}/cancelar`)
          .set(ctx.authHeader)
          .send({ justificativa: JUSTIFICATIVA }),
      ]);
      const statuses = [a.status, b.status].sort((x, y) => x - y);
      assert.equal(counts.cancelar, 1, "só um cancelamento pode POST");
      assert.ok(
        statuses.includes(409) || statuses.every((s) => [200, 201].includes(s)),
        `esperado 409+sucesso ou dois idempotentes; veio ${a.status}/${b.status} ${a.body?.error || ""} ${b.body?.error || ""}`,
      );
      if (statuses.includes(409)) {
        assert.ok([200, 201].includes(statuses[0] === 409 ? statuses[1] : statuses[0]));
      }
      const got = await request(app)
        .get(`/api/fiscal/cte/${draft.body.data.id}`)
        .set(ctx.authHeader);
      assert.equal(got.body.data.status, "cancelado");
    } finally {
      globalThis.fetch = originalFetch;
      await cleanupFiscal(ctx.tenantId);
      await cleanupTenant(ctx.tenantId);
    }
  },
);

test(
  "concorrência real: dois encerramentos do mesmo MDF-e — um avança, o outro 409 ou idempotente",
  { skip },
  async () => {
    const ctx = await setupTenant();
    const originalFetch = globalThis.fetch;
    const counts = { cte: 0, mdfe: 0, encerrar: 0 };
    const chaveCte = `3526${Date.now()}`.padEnd(44, "6").slice(0, 44);
    const chaveMdfe = `5826${Date.now()}`.padEnd(44, "7").slice(0, 44);
    try {
      globalThis.fetch = async (input) => {
        const url = urlOf(input);
        if (url.includes("EnviarConhecimentoTransporte")) {
          counts.cte += 1;
          return jsonResponse({
            status: 0,
            chave: chaveCte,
            numero: 60,
            serie: 1,
            NuProtocolo: "900060",
          });
        }
        if (url.includes("EnviarManifestoTransporte")) {
          counts.mdfe += 1;
          return jsonResponse({
            status: 0,
            chave: chaveMdfe,
            numero: 70,
            serie: 1,
            NuProtocolo: "900070",
          });
        }
        if (url.includes("EncerrarManifestoTransporte")) {
          counts.encerrar += 1;
          await sleep(250);
          return jsonResponse({ status: 1, DsMotivo: "Encerramento autorizado" });
        }
        if (url.includes("ObterNotasFiscais") || url.includes("ObterArquivoNotaFiscal")) {
          return jsonResponse({ Notas: [] });
        }
        throw new Error(`URL inesperada no encerramento: ${url}`);
      };

      const cteDraft = await request(app)
        .post("/api/fiscal/cte")
        .set(ctx.authHeader)
        .send(payloadCteRascunho(ctx.clienteId, { fiscal_empresa_id: ctx.empresaId }));
      assert.equal(cteDraft.status, 201, cteDraft.body?.error);
      const cteEmit = await request(app)
        .post(`/api/fiscal/cte/${cteDraft.body.data.id}/emitir`)
        .set(ctx.authHeader);
      assert.equal(cteEmit.status, 201, cteEmit.body?.error);

      const mdfeDraft = await request(app)
        .post("/api/fiscal/mdfe")
        .set(ctx.authHeader)
        .send({
          fiscal_empresa_id: ctx.empresaId,
          uf_carregamento: "SP",
          uf_descarregamento: "RJ",
          data_emissao: new Date().toISOString(),
          rodoviario: {
            placa: "ABC1D23",
            condutores: [{ nome: "Joao Motorista", cpf: "12345678909" }],
          },
          cte_ids: [cteDraft.body.data.id],
          resp_seg: 1,
          numero_apolice: "AP-ENC-1",
        });
      assert.equal(mdfeDraft.status, 201, mdfeDraft.body?.error);
      const mdfeEmit = await request(app)
        .post(`/api/fiscal/mdfe/${mdfeDraft.body.data.id}/emitir`)
        .set(ctx.authHeader);
      assert.equal(mdfeEmit.status, 201, mdfeEmit.body?.error);

      const [a, b] = await Promise.all([
        request(app)
          .post(`/api/fiscal/mdfe/${mdfeDraft.body.data.id}/encerrar`)
          .set(ctx.authHeader)
          .send({}),
        request(app)
          .post(`/api/fiscal/mdfe/${mdfeDraft.body.data.id}/encerrar`)
          .set(ctx.authHeader)
          .send({}),
      ]);
      const statuses = [a.status, b.status];
      assert.equal(counts.encerrar, 1, "só um encerramento pode POST");
      assert.ok(
        statuses.includes(409) || statuses.every((s) => [200, 201].includes(s)),
        `esperado 409+sucesso; veio ${a.status}/${b.status} ${a.body?.error || ""} ${b.body?.error || ""}`,
      );
      const got = await request(app)
        .get(`/api/fiscal/mdfe/${mdfeDraft.body.data.id}`)
        .set(ctx.authHeader);
      assert.equal(got.body.data.status, "encerrado");
    } finally {
      globalThis.fetch = originalFetch;
      await cleanupFiscal(ctx.tenantId);
      await cleanupTenant(ctx.tenantId);
    }
  },
);

test(
  "concorrência real: dois registros CIOT do mesmo contrato — um avança, o outro 409",
  { skip },
  async () => {
    const ctx = await setupTenant();
    const originalDeclarar = CiotProviderClient.declararOperacaoTransporte;
    const prevUrl = process.env.FISCAL_CIOT_URL;
    process.env.FISCAL_CIOT_URL = "https://ciot.test.local";
    let declararCalls = 0;
    try {
      await prisma.fiscal_empresas.update({
        where: { id: ctx.empresaId },
        data: { certificado_pfx_path: "fiscal/certificados/ciot-teste.pfx" },
      });

      const created = await request(app)
        .post("/api/fiscal/contratos-frete")
        .set(ctx.authHeader)
        .send({
          fiscal_empresa_id: ctx.empresaId,
          tipo_operacao: 3,
          cpf_cnpj_contratado: "12345678000195",
          rntrc_contratado: "123456789",
          cpf_cnpj_contratante: "98765432000198",
          valor_frete: 2500,
          valor_piso_minimo_frete: 2100,
          valor_vale_pedagio: 0,
          data_inicio_viagem: "2026-09-10",
          data_fim_viagem: "2026-09-12",
          veiculos: [
            { placa: "ABC1D23", rntrc_veiculo: "123456789", numero_eixos: 5 },
            { placa: "ABC1D24", rntrc_veiculo: "123456789", numero_eixos: 3 },
          ],
          inf_pagamento: [{ tipo_pagamento: 1, valor: 2500 }],
        });
      assert.equal(created.status, 201, created.body?.error);
      const contratoId = created.body.data.id;

      CiotProviderClient.declararOperacaoTransporte = async () => {
        declararCalls += 1;
        await sleep(250);
        return {
          Codigo: 110,
          Mensagem: "OK",
          CodigoIdentificacaoOperacao: "123456789012",
          CodigoVerificador: "ABC",
          Protocolo: "P-1",
        };
      };

      const [a, b] = await Promise.all([
        request(app)
          .post(`/api/fiscal/contratos-frete/${contratoId}/ciot`)
          .set(ctx.authHeader)
          .send({}),
        request(app)
          .post(`/api/fiscal/contratos-frete/${contratoId}/ciot`)
          .set(ctx.authHeader)
          .send({}),
      ]);
      const statuses = [a.status, b.status].sort((x, y) => x - y);
      assert.equal(declararCalls, 1, "só um registro CIOT pode POST no provedor");
      assert.ok(
        statuses.includes(409) && statuses.some((s) => [200, 201].includes(s)),
        `esperado 201+409; veio ${a.status}/${b.status} ${a.body?.error || ""} ${b.body?.error || ""}`,
      );
    } finally {
      CiotProviderClient.declararOperacaoTransporte = originalDeclarar;
      if (prevUrl != null) process.env.FISCAL_CIOT_URL = prevUrl;
      else delete process.env.FISCAL_CIOT_URL;
      await cleanupFiscal(ctx.tenantId);
      await cleanupTenant(ctx.tenantId);
    }
  },
);
