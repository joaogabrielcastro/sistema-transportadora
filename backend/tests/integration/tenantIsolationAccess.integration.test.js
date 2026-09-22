import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
import {
  cleanupCaminhao,
  cleanupTenant,
  createCaminhaoViaApi,
  createSecondaryTenantAdmin,
  ensurePneuLookups,
  loginWithCredentials,
  testPlaca,
} from "../helpers/dbTestFixtures.js";

const skip = shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI";

function denied(status) {
  assert.ok(status === 403 || status === 404, `esperado 403 ou 404, recebeu ${status}`);
}

test("JWT de usuário desativado é recusado antes de expirar", { skip }, async () => {
  const secondary = await createSecondaryTenantAdmin({
    slug: `off-${Date.now().toString(36)}`,
  });
  try {
    const session = await loginWithCredentials(
      app,
      secondary.email,
      secondary.password,
    );
    const alive = await request(app)
      .get("/api/caminhoes")
      .query({ page: 1, limit: 5 })
      .set(session.authHeader);
    assert.equal(alive.status, 200);

    await prisma.users.update({
      where: { email: secondary.email },
      data: { ativo: false },
    });

    const dead = await request(app)
      .get("/api/caminhoes")
      .query({ page: 1, limit: 5 })
      .set(session.authHeader);
    assert.equal(dead.status, 401);
    assert.match(String(dead.body?.error || ""), /inativ|revogad/i);
  } finally {
    await cleanupTenant(secondary.tenant.id);
  }
});

test("tenant A não acessa recursos do tenant B por id", { skip }, async () => {
  const tenantA = await createSecondaryTenantAdmin({
    slug: `iso-a-${Date.now().toString(36)}`,
    email: `a-${Date.now().toString(36)}@iso.local`,
    features: {
      ordem_coleta: false,
      notas_estoque: true,
      transporte_fiscal: true,
    },
  });
  const tenantB = await createSecondaryTenantAdmin({
    slug: `iso-b-${Date.now().toString(36)}`,
    email: `b-${Date.now().toString(36)}@iso.local`,
    features: {
      ordem_coleta: false,
      notas_estoque: true,
      transporte_fiscal: true,
    },
  });
  const sessionA = await loginWithCredentials(app, tenantA.email, tenantA.password);
  const sessionB = await loginWithCredentials(app, tenantB.email, tenantB.password);
  const lookups = await ensurePneuLookups();
  let caminhaoB;

  try {
    caminhaoB = await createCaminhaoViaApi(app, sessionB.authHeader, {
      placa: testPlaca("ISO"),
    });

    const motorista = await request(app)
      .post("/api/motoristas")
      .set(sessionB.authHeader)
      .send({ nome: "Motorista Isolado" });
    assert.equal(motorista.status, 201, motorista.body?.error);
    const motoristaId = motorista.body.data.id;

    const getMotorista = await request(app)
      .get(`/api/motoristas/${motoristaId}`)
      .set(sessionA.authHeader);
    denied(getMotorista.status);
    const patchMotorista = await request(app)
      .patch(`/api/motoristas/${motoristaId}`)
      .set(sessionA.authHeader)
      .send({ nome: "Invadido" });
    denied(patchMotorista.status);

    const pneu = await prisma.pneus.create({
      data: {
        tenant_id: tenantB.tenant.id,
        caminhao_id: caminhaoB.id,
        posicao_id: lookups.posicaoAId,
        status_id: lookups.statusId,
      },
    });
    const getPneu = await request(app)
      .get(`/api/pneus/${pneu.id}`)
      .set(sessionA.authHeader);
    denied(getPneu.status);
    const putPneu = await request(app)
      .put(`/api/pneus/${pneu.id}`)
      .set(sessionA.authHeader)
      .send({ marca: "Invadido" });
    denied(putPneu.status);

    const doc = await prisma.caminhao_documentos.create({
      data: {
        tenant_id: tenantB.tenant.id,
        caminhao_id: caminhaoB.id,
        nome_original: "doc.pdf",
        arquivo_path: "teste/doc.pdf",
        tamanho_bytes: 10,
      },
    });
    const getDoc = await request(app)
      .get(`/api/caminhoes/${caminhaoB.placa}/documentos/${doc.id}`)
      .set(sessionA.authHeader);
    denied(getDoc.status);

    const nota = await prisma.notas_fiscais.create({
      data: {
        tenant_id: tenantB.tenant.id,
        numero: `N${Date.now()}`,
        origem: "manual",
      },
    });
    const getNota = await request(app)
      .get(`/api/notas-fiscais/${nota.id}`)
      .set(sessionA.authHeader);
    denied(getNota.status);

    const userB = await prisma.users.findFirst({
      where: { email: tenantB.email },
    });
    const patchUser = await request(app)
      .patch(`/api/users/${userB.id}`)
      .set(sessionA.authHeader)
      .send({ nome: "Invadido" });
    denied(patchUser.status);

    const marker = `audit-iso-${Date.now()}`;
    await prisma.audit_logs.create({
      data: {
        tenant_id: tenantB.tenant.id,
        action: "POST",
        method: "POST",
        path: `/api/teste/${marker}`,
      },
    });
    const logs = await request(app)
      .get("/api/ops/audit-logs")
      .query({ q: marker, limit: 20 })
      .set(sessionA.authHeader);
    assert.equal(logs.status, 200);
    const list = logs.body?.data?.items || [];
    assert.equal(
      list.some((row) => String(row.path || "").includes(marker)),
      false,
    );

    const chave = `${Date.now()}`.padStart(44, "1").slice(0, 44);
    const averbacao = await prisma.fiscal_averbacoes.create({
      data: {
        tenant_id: tenantB.tenant.id,
        tipo_documento: "cte",
        provider: "atm",
        ambiente: "homologacao",
        chave_acesso: chave,
      },
    });
    const getAverbacao = await request(app)
      .get(`/api/fiscal/seguro/averbacoes/${averbacao.id}`)
      .set(sessionA.authHeader);
    denied(getAverbacao.status);
  } finally {
    await cleanupCaminhao(caminhaoB?.id);
    await cleanupTenant(tenantA.tenant.id);
    await cleanupTenant(tenantB.tenant.id);
  }
});
