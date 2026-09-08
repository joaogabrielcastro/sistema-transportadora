import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";
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

function payloadContrato(empresaId, extras = {}) {
  return {
    fiscal_empresa_id: empresaId,
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
    ...extras,
  };
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

test(
  "contrato de frete: criar, editar, consultar, cancelar e isolamento por tenant",
  { skip },
  async () => {
    process.env.FISCAL_SECRETS_KEY =
      process.env.FISCAL_SECRETS_KEY || "integration-fiscal-secrets-key";

    const tenantA = await createSecondaryTenantAdmin({
      slug: `cf-a-${Date.now().toString(36)}`,
      email: `cf-a-${Date.now().toString(36)}@tenant.local`,
      features: FISCAL_FEATURES,
    });
    const tenantB = await createSecondaryTenantAdmin({
      slug: `cf-b-${Date.now().toString(36)}`,
      email: `cf-b-${Date.now().toString(36)}@tenant.local`,
      features: FISCAL_FEATURES,
    });

    try {
      const a = await loginWithCredentials(app, tenantA.email, tenantA.password);
      const b = await loginWithCredentials(app, tenantB.email, tenantB.password);

      const empresa = await request(app)
        .post("/api/fiscal/empresas")
        .set(a.authHeader)
        .send({
          cnpj: "12345678000195",
          razao_social: "Transportes A",
          crt: 1,
        });
      assert.equal(empresa.status, 201, empresa.body?.error);
      const empresaId = empresa.body.data.id;

      const created = await request(app)
        .post("/api/fiscal/contratos-frete")
        .set(a.authHeader)
        .send(payloadContrato(empresaId));
      assert.equal(created.status, 201, created.body?.error);
      assert.equal(created.body.data.status, "ativo");
      assert.equal(created.body.data.ciot, null);
      assert.equal(created.body.data.ciot_status, "nao_registrado");
      assert.equal(created.body.data.codigo_identificacao_operacao, null);
      const contratoId = created.body.data.id;

      const listed = await request(app)
        .get("/api/fiscal/contratos-frete")
        .set(a.authHeader);
      assert.equal(listed.status, 200);
      assert.ok(listed.body.data.some((c) => c.id === contratoId));

      const got = await request(app)
        .get(`/api/fiscal/contratos-frete/${contratoId}`)
        .set(a.authHeader);
      assert.equal(got.status, 200);
      assert.equal(got.body.data.valor_frete, 2500);
      assert.equal(got.body.data.ciot, null);

      const edited = await request(app)
        .put(`/api/fiscal/contratos-frete/${contratoId}`)
        .set(a.authHeader)
        .send(payloadContrato(empresaId, { valor_frete: 2600, valor_piso_minimo_frete: 2100 }));
      assert.equal(edited.status, 200, edited.body?.error);
      assert.equal(Number(edited.body.data.valor_frete), 2600);

      const listB = await request(app)
        .get("/api/fiscal/contratos-frete")
        .set(b.authHeader);
      assert.equal(listB.status, 200);
      assert.ok(!listB.body.data.some((c) => c.id === contratoId));

      const getB = await request(app)
        .get(`/api/fiscal/contratos-frete/${contratoId}`)
        .set(b.authHeader);
      assert.equal(getB.status, 404);

      const putB = await request(app)
        .put(`/api/fiscal/contratos-frete/${contratoId}`)
        .set(b.authHeader)
        .send(payloadContrato(empresaId));
      assert.equal(putB.status, 404);

      const ciotB = await request(app)
        .post(`/api/fiscal/contratos-frete/${contratoId}/ciot`)
        .set(b.authHeader)
        .send({});
      assert.equal(ciotB.status, 404);

      const cancelB = await request(app)
        .post(`/api/fiscal/contratos-frete/${contratoId}/cancelar`)
        .set(b.authHeader);
      assert.equal(cancelB.status, 404);

      const canceled = await request(app)
        .post(`/api/fiscal/contratos-frete/${contratoId}/cancelar`)
        .set(a.authHeader);
      assert.equal(canceled.status, 200, canceled.body?.error);
      assert.equal(canceled.body.data.status, "cancelado");
      assert.equal(canceled.body.data.ciot_status, "nao_registrado");
    } finally {
      await cleanupFiscal(tenantA.tenant.id);
      await cleanupFiscal(tenantB.tenant.id);
      await cleanupTenant(tenantA.tenant.id);
      await cleanupTenant(tenantB.tenant.id);
    }
  },
);

test(
  "CIOT: registro falha sem provedor, persiste erro no registro do contrato, legado /ciot lista contratos",
  { skip },
  async () => {
    process.env.FISCAL_SECRETS_KEY =
      process.env.FISCAL_SECRETS_KEY || "integration-fiscal-secrets-key";
    const prevUrl = process.env.FISCAL_CIOT_URL;
    delete process.env.FISCAL_CIOT_URL;

    const tenantA = await createSecondaryTenantAdmin({
      slug: `ciot-a-${Date.now().toString(36)}`,
      email: `ciot-a-${Date.now().toString(36)}@tenant.local`,
      features: FISCAL_FEATURES,
    });

    try {
      const a = await loginWithCredentials(app, tenantA.email, tenantA.password);
      const empresa = await request(app)
        .post("/api/fiscal/empresas")
        .set(a.authHeader)
        .send({
          cnpj: "12345678000195",
          razao_social: "Transportes CIOT",
          crt: 1,
          certificado_senha: "senha-teste",
        });
      assert.equal(empresa.status, 201, empresa.body?.error);

      const created = await request(app)
        .post("/api/fiscal/contratos-frete")
        .set(a.authHeader)
        .send(payloadContrato(empresa.body.data.id));
      assert.equal(created.status, 201, created.body?.error);
      const contratoId = created.body.data.id;

      const register = await request(app)
        .post(`/api/fiscal/contratos-frete/${contratoId}/ciot`)
        .set(a.authHeader)
        .send({});
      assert.ok(
        register.status >= 400,
        `esperava erro do provedor, veio ${register.status}`,
      );

      const after = await request(app)
        .get(`/api/fiscal/contratos-frete/${contratoId}`)
        .set(a.authHeader);
      assert.equal(after.status, 200);
      assert.equal(after.body.data.id, contratoId);
      if (after.body.data.ciot) {
        assert.equal(after.body.data.ciot.status, "erro");
        assert.notEqual(after.body.data.status, after.body.data.ciot.status);
      }

      const legado = await request(app)
        .get("/api/fiscal/ciot")
        .set(a.authHeader);
      assert.equal(legado.status, 200);
      assert.ok(legado.body.data.some((c) => c.id === contratoId));
    } finally {
      if (prevUrl != null) process.env.FISCAL_CIOT_URL = prevUrl;
      else delete process.env.FISCAL_CIOT_URL;
      await cleanupFiscal(tenantA.tenant.id);
      await cleanupTenant(tenantA.tenant.id);
    }
  },
);

test(
  "CT-e não cria contrato a partir de CIOT e recusa contrato sem CIOT registrado",
  { skip },
  async () => {
    process.env.FISCAL_SECRETS_KEY =
      process.env.FISCAL_SECRETS_KEY || "integration-fiscal-secrets-key";

    const tenantA = await createSecondaryTenantAdmin({
      slug: `cte-cf-${Date.now().toString(36)}`,
      email: `cte-cf-${Date.now().toString(36)}@tenant.local`,
      features: FISCAL_FEATURES,
    });

    try {
      const a = await loginWithCredentials(app, tenantA.email, tenantA.password);
      const empresa = await request(app)
        .post("/api/fiscal/empresas")
        .set(a.authHeader)
        .send({ cnpj: "12345678000195", razao_social: "Emissora", crt: 1 });
      assert.equal(empresa.status, 201, empresa.body?.error);

      const cliente = await request(app)
        .post("/api/fiscal/clientes")
        .set(a.authHeader)
        .send({ razao_social: "Tomador", cnpj_cpf: "12345678000195" });
      assert.equal(cliente.status, 201, cliente.body?.error);

      const contrato = await request(app)
        .post("/api/fiscal/contratos-frete")
        .set(a.authHeader)
        .send(payloadContrato(empresa.body.data.id));
      assert.equal(contrato.status, 201, contrato.body?.error);

      const beforeCount = await prisma.fiscal_contratos_frete.count({
        where: { tenant_id: tenantA.tenant.id },
      });

      const cte = await request(app)
        .post("/api/fiscal/cte")
        .set(a.authHeader)
        .send({
          cliente_id: cliente.body.data.id,
          tipo_cte: "0",
          cfop: "6353",
          natureza_operacao: "Transporte",
          dt_emissao: new Date().toISOString(),
          servico: { valor_prestacao: 150 },
          tomador: { cpf_cnpj: "12345678000195" },
          ciot: "999888777666",
        });
      assert.equal(cte.status, 201, cte.body?.error);
      assert.equal(cte.body.data.antt_ciot, "999888777666");
      assert.equal(cte.body.data.contrato_frete_id, null);

      const afterCount = await prisma.fiscal_contratos_frete.count({
        where: { tenant_id: tenantA.tenant.id },
      });
      assert.equal(afterCount, beforeCount);

      const cteVinculado = await request(app)
        .post("/api/fiscal/cte")
        .set(a.authHeader)
        .send({
          cliente_id: cliente.body.data.id,
          tipo_cte: "0",
          cfop: "6353",
          natureza_operacao: "Transporte",
          dt_emissao: new Date().toISOString(),
          servico: { valor_prestacao: 150 },
          tomador: { cpf_cnpj: "12345678000195" },
          contrato_frete_id: contrato.body.data.id,
        });
      assert.equal(cteVinculado.status, 400, cteVinculado.body?.error);
      assert.match(
        String(cteVinculado.body?.error || ""),
        /CIOT registrado/i,
      );
    } finally {
      await cleanupFiscal(tenantA.tenant.id);
      await cleanupTenant(tenantA.tenant.id);
    }
  },
);
