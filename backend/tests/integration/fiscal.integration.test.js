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
