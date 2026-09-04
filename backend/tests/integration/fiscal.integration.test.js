import { rmSync } from "node:fs";
import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
import {
  loginAsAdmin,
  createSecondaryTenantAdmin,
  loginWithCredentials,
  cleanupTenant,
} from "../helpers/dbTestFixtures.js";

const skip = shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI";

/** NF-e de teste com DV válido — a emissão de CT-e exige infDoc. */
const CHAVE_NFE_TESTE = "35240000000000000000000000000000000000000000";

function payloadCteRascunho(clienteId, extras = {}) {
  return {
    cliente_id: clienteId,
    tipo_cte: "0",
    cfop: "6353",
    natureza_operacao: "Transporte",
    dt_emissao: new Date().toISOString(),
    servico: { valor_prestacao: 150 },
    tomador: { cpf_cnpj: "12345678000199" },
    chave_nfe_referenciada: CHAVE_NFE_TESTE,
    ...extras,
  };
}

const FISCAL_FEATURES = {
  ordem_coleta: true,
  notas_estoque: false,
  transporte_fiscal: true,
};

test.after(() => {
  if (process.env.UPLOADS_DIR) {
    rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  }
});

/** Remove linhas fiscais do tenant antes do cleanupTenant padrão (FK RESTRICT). */
async function cleanupFiscal(tenantId) {
  if (!tenantId) return;
  await prisma.fiscal_ctes.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.fiscal_mdfes.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.fiscal_ciots.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.fiscal_clientes.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
  await prisma.fiscal_empresas.deleteMany({ where: { tenant_id: tenantId } }).catch(() => {});
}

test(
  "tenant SEM a feature transporte_fiscal recebe 403 nas rotas fiscais",
  { skip },
  async () => {
    // createSecondaryTenantAdmin usa features sem transporte_fiscal por padrão.
    const secondary = await createSecondaryTenantAdmin({
      slug: `nofiscal-${Date.now().toString(36)}`,
      email: `nofiscal-${Date.now().toString(36)}@tenant.local`,
    });
    try {
      const { authHeader } = await loginWithCredentials(
        app,
        secondary.email,
        secondary.password,
      );

      for (const path of [
        "/api/fiscal/empresas",
        "/api/fiscal/clientes",
        "/api/fiscal/cte",
        "/api/fiscal/mdfe",
        "/api/fiscal/ciot",
      ]) {
        const res = await request(app).get(path).set(authHeader);
        assert.equal(res.status, 403, `${path} deveria dar 403`);
        assert.match(String(res.body?.error || ""), /não disponível|Módulo/i);
        assert.equal(res.body?.feature, "transporte_fiscal");
      }

      const post = await request(app)
        .post("/api/fiscal/clientes")
        .set(authHeader)
        .send({ razao_social: "X", cnpj_cpf: "12345678000199" });
      assert.equal(post.status, 403);
    } finally {
      await cleanupFiscal(secondary.tenant.id);
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "tenant COM a feature: CRUD de cliente e normalização de cnpj_cpf",
  { skip },
  async () => {
    const secondary = await createSecondaryTenantAdmin({
      slug: `fiscal-${Date.now().toString(36)}`,
      email: `fiscal-${Date.now().toString(36)}@tenant.local`,
      features: FISCAL_FEATURES,
    });
    try {
      const { authHeader } = await loginWithCredentials(
        app,
        secondary.email,
        secondary.password,
      );

      const create = await request(app)
        .post("/api/fiscal/clientes")
        .set(authHeader)
        .send({
          razao_social: "Comércio de Peças Ltda",
          cnpj_cpf: "12.345.678/0001-99",
        });
      assert.equal(create.status, 201, create.body?.error);
      assert.equal(create.body.data.cnpj_cpf, "12345678000199");

      const list = await request(app)
        .get("/api/fiscal/clientes")
        .set(authHeader);
      assert.equal(list.status, 200);
      assert.ok(list.body.data.some((c) => c.id === create.body.data.id));
    } finally {
      await cleanupFiscal(secondary.tenant.id);
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "isolamento de tenant nas tabelas fiscais (fiscal_clientes / fiscal_ctes)",
  { skip },
  async () => {
    await loginAsAdmin(app); // garante tenant seed
    const tenantA = await createSecondaryTenantAdmin({
      slug: `fa-${Date.now().toString(36)}`,
      email: `fa-${Date.now().toString(36)}@tenant.local`,
      features: FISCAL_FEATURES,
    });
    const tenantB = await createSecondaryTenantAdmin({
      slug: `fb-${Date.now().toString(36)}`,
      email: `fb-${Date.now().toString(36)}@tenant.local`,
      features: FISCAL_FEATURES,
    });

    try {
      const a = await loginWithCredentials(app, tenantA.email, tenantA.password);
      const b = await loginWithCredentials(app, tenantB.email, tenantB.password);

      const clienteA = await request(app)
        .post("/api/fiscal/clientes")
        .set(a.authHeader)
        .send({ razao_social: "Cliente do A", cnpj_cpf: "11222333000181" });
      assert.equal(clienteA.status, 201, clienteA.body?.error);
      const clienteAId = clienteA.body.data.id;

      // B não lista cliente do A
      const listB = await request(app)
        .get("/api/fiscal/clientes")
        .set(b.authHeader);
      assert.equal(listB.status, 200);
      assert.ok(!listB.body.data.some((c) => c.id === clienteAId));

      // B não abre cliente do A por id
      const getB = await request(app)
        .get(`/api/fiscal/clientes/${clienteAId}`)
        .set(b.authHeader);
      assert.equal(getB.status, 404);

      // B não edita nem apaga cliente do A
      const putB = await request(app)
        .put(`/api/fiscal/clientes/${clienteAId}`)
        .set(b.authHeader)
        .send({ razao_social: "hackeado" });
      assert.equal(putB.status, 404);

      const delB = await request(app)
        .delete(`/api/fiscal/clientes/${clienteAId}`)
        .set(b.authHeader);
      assert.equal(delB.status, 404);

      // mesma chave_acesso não pode existir em 2 tenants (unique global)
      const chave = `3524${Date.now()}`.padEnd(44, "0").slice(0, 44);
      await prisma.fiscal_ctes.create({
        data: {
          tenant_id: tenantA.tenant.id,
          cliente_id: clienteAId,
          chave_acesso: chave,
          status: "processado",
        },
      });
      await assert.rejects(
        () =>
          prisma.fiscal_ctes.create({
            data: {
              tenant_id: tenantB.tenant.id,
              cliente_id: clienteAId,
              chave_acesso: chave,
              status: "processado",
            },
          }),
        /Unique constraint|unique/i,
      );

      // CT-e do A não aparece para o B via API
      const cteListB = await request(app).get("/api/fiscal/cte").set(b.authHeader);
      assert.equal(cteListB.status, 200);
      assert.equal(cteListB.body.data.length, 0);
    } finally {
      await cleanupFiscal(tenantA.tenant.id);
      await cleanupFiscal(tenantB.tenant.id);
      await cleanupTenant(tenantA.tenant.id);
      await cleanupTenant(tenantB.tenant.id);
    }
  },
);

test(
  "CT-e rascunho: CRUD, isolamento por tenant, emissão mockada, rejeição e idempotência",
  { skip },
  async () => {
    process.env.FISCAL_SECRETS_KEY =
      process.env.FISCAL_SECRETS_KEY || "integration-fiscal-secrets-key";

    const tenantA = await createSecondaryTenantAdmin({
      slug: `cte-a-${Date.now().toString(36)}`,
      email: `cte-a-${Date.now().toString(36)}@tenant.local`,
      features: FISCAL_FEATURES,
    });
    const tenantB = await createSecondaryTenantAdmin({
      slug: `cte-b-${Date.now().toString(36)}`,
      email: `cte-b-${Date.now().toString(36)}@tenant.local`,
      features: FISCAL_FEATURES,
    });

    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    const chave = `3526${Date.now()}`.padEnd(44, "9").slice(0, 44);

    try {
      const a = await loginWithCredentials(app, tenantA.email, tenantA.password);
      const b = await loginWithCredentials(app, tenantB.email, tenantB.password);

      const empresa = await request(app)
        .post("/api/fiscal/empresas")
        .set(a.authHeader)
        .send({
          cnpj: "12345678000199",
          razao_social: "Emissora A",
          crt: 1,
          cte_mdfe_provider_token: "token-empresa-a",
        });
      assert.equal(empresa.status, 201, empresa.body?.error);
      assert.equal(empresa.body.data.cte_mdfe_provider_token, undefined);
      assert.equal(empresa.body.data.cte_mdfe_provider_token_set, true);

      const cliente = await request(app)
        .post("/api/fiscal/clientes")
        .set(a.authHeader)
        .send({ razao_social: "Tomador A", cnpj_cpf: "12345678000199" });
      assert.equal(cliente.status, 201, cliente.body?.error);
      const clienteId = cliente.body.data.id;

      const draft = await request(app)
        .post("/api/fiscal/cte")
        .set(a.authHeader)
        .send(payloadCteRascunho(clienteId));
      assert.equal(draft.status, 201, draft.body?.error);
      assert.equal(draft.body.data.status, "rascunho");
      assert.equal(draft.body.data.chave_acesso, null);
      const cteId = draft.body.data.id;

      const listB = await request(app).get("/api/fiscal/cte").set(b.authHeader);
      assert.equal(listB.status, 200);
      assert.ok(!listB.body.data.some((c) => c.id === cteId));

      const getB = await request(app)
        .get(`/api/fiscal/cte/${cteId}`)
        .set(b.authHeader);
      assert.equal(getB.status, 404);

      const emitB = await request(app)
        .post(`/api/fiscal/cte/${cteId}/emitir`)
        .set(b.authHeader);
      assert.equal(emitB.status, 404);

      globalThis.fetch = async () => {
        fetchCalls += 1;
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              status: 0,
              chave,
              numero: 1,
              serie: 1,
              NuProtocolo: "900001",
            }),
        };
      };

      const emit1 = await request(app)
        .post(`/api/fiscal/cte/${cteId}/emitir`)
        .set(a.authHeader);
      assert.equal(emit1.status, 201, emit1.body?.error);
      assert.equal(emit1.body.data.status, "processado");
      assert.equal(emit1.body.data.chave_acesso, chave);
      assert.equal(fetchCalls, 1);

      const emit2 = await request(app)
        .post(`/api/fiscal/cte/${cteId}/emitir`)
        .set(a.authHeader);
      assert.equal(emit2.status, 201, emit2.body?.error);
      assert.equal(emit2.body.data.status, "processado");
      assert.equal(fetchCalls, 1, "segunda emissão não pode chamar a Brasil NFe");

      const draftRej = await request(app)
        .post("/api/fiscal/cte")
        .set(a.authHeader)
        .send(
          payloadCteRascunho(clienteId, { servico: { valor_prestacao: 10 } }),
        );
      assert.equal(draftRej.status, 201, draftRej.body?.error);

      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: 2,
            erros: ["Rejeição 204: Duplicidade"],
            DsMotivo: "Rejeição 204",
            CodStatusRespostaSefaz: 204,
          }),
      });

      const emitRej = await request(app)
        .post(`/api/fiscal/cte/${draftRej.body.data.id}/emitir`)
        .set(a.authHeader);
      assert.equal(emitRej.status, 400);
      const recarregado = await request(app)
        .get(`/api/fiscal/cte/${draftRej.body.data.id}`)
        .set(a.authHeader);
      assert.equal(recarregado.body.data.status, "rejeitado");
      assert.equal(recarregado.body.data.sefaz_codigo, 204);
    } finally {
      globalThis.fetch = originalFetch;
      await cleanupFiscal(tenantA.tenant.id);
      await cleanupFiscal(tenantB.tenant.id);
      await cleanupTenant(tenantA.tenant.id);
      await cleanupTenant(tenantB.tenant.id);
    }
  },
);

test(
  "MDF-e rascunho: CRUD, isolamento e validação antes da Brasil NFe",
  { skip },
  async () => {
    process.env.FISCAL_SECRETS_KEY =
      process.env.FISCAL_SECRETS_KEY || "integration-fiscal-secrets-key";

    const tenantA = await createSecondaryTenantAdmin({
      slug: `mdfe-a-${Date.now().toString(36)}`,
      email: `mdfe-a-${Date.now().toString(36)}@tenant.local`,
      features: FISCAL_FEATURES,
    });
    const tenantB = await createSecondaryTenantAdmin({
      slug: `mdfe-b-${Date.now().toString(36)}`,
      email: `mdfe-b-${Date.now().toString(36)}@tenant.local`,
      features: FISCAL_FEATURES,
    });

    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;

    try {
      const a = await loginWithCredentials(app, tenantA.email, tenantA.password);
      const b = await loginWithCredentials(app, tenantB.email, tenantB.password);

      const draft = await request(app)
        .post("/api/fiscal/mdfe")
        .set(a.authHeader)
        .send({
          uf_carregamento: "SP",
          uf_descarregamento: "RJ",
          data_emissao: new Date().toISOString(),
        });
      assert.equal(draft.status, 201, draft.body?.error);
      assert.equal(draft.body.data.status, "rascunho");
      const mdfeId = draft.body.data.id;

      const listB = await request(app).get("/api/fiscal/mdfe").set(b.authHeader);
      assert.equal(listB.status, 200);
      assert.ok(!listB.body.data.some((m) => m.id === mdfeId));

      const getB = await request(app)
        .get(`/api/fiscal/mdfe/${mdfeId}`)
        .set(b.authHeader);
      assert.equal(getB.status, 404);

      globalThis.fetch = async () => {
        fetchCalls += 1;
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ status: 1, chave: "x" }),
        };
      };

      const emitirIncompleto = await request(app)
        .post(`/api/fiscal/mdfe/${mdfeId}/emitir`)
        .set(a.authHeader);
      assert.equal(emitirIncompleto.status, 400);
      assert.equal(fetchCalls, 0, "validação fiscal deve ocorrer antes do HTTP");

      const recarregado = await request(app)
        .get(`/api/fiscal/mdfe/${mdfeId}`)
        .set(a.authHeader);
      assert.ok(
        ["rascunho", "erro", "processando"].includes(recarregado.body.data.status),
      );
    } finally {
      globalThis.fetch = originalFetch;
      await cleanupFiscal(tenantA.tenant.id);
      await cleanupFiscal(tenantB.tenant.id);
      await cleanupTenant(tenantA.tenant.id);
      await cleanupTenant(tenantB.tenant.id);
    }
  },
);
