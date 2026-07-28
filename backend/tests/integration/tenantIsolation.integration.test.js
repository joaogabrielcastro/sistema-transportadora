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
  createCaminhaoViaApi,
  cleanupCaminhao,
  cleanupTenant,
} from "../helpers/dbTestFixtures.js";

test.after(() => {
  if (process.env.UPLOADS_DIR) {
    rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  }
});

test(
  "login retorna tenantId no user e JWT",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { user, token } = await loginAsAdmin(app);
    assert.ok(user.tenantId);
    assert.ok(token);
  },
);

test(
  "JWT sem tenantId é rejeitado com 401",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { signAccessToken } = await import("../../src/utils/jwt.js");
    const token = signAccessToken({
      sub: "1",
      email: "no-tenant@test.local",
      role: "admin",
      nome: "Sem Tenant",
    });

    const res = await request(app)
      .get("/api/caminhoes")
      .query({ page: 1, limit: 10 })
      .set({ Authorization: `Bearer ${token}` });

    assert.equal(res.status, 401);
    assert.match(String(res.body?.error || ""), /tenant/i);
  },
);

test(
  "login rejeita usuário de tenant inativo",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const secondary = await createSecondaryTenantAdmin({
      slug: `inactive-${Date.now().toString(36)}`,
      email: `inactive-${Date.now().toString(36)}@tenant.local`,
    });

    try {
      await prisma.tenants.update({
        where: { id: secondary.tenant.id },
        data: { ativo: false },
      });

      const res = await request(app).post("/api/auth/login").send({
        email: secondary.email,
        password: secondary.password,
      });

      assert.equal(res.status, 401);
      assert.match(String(res.body?.error || ""), /inativa|Empresa/i);
    } finally {
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "tenant A não lista caminhão do tenant B",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const tenantA = await loginAsAdmin(app);
    const secondary = await createSecondaryTenantAdmin();
    const tenantB = await loginWithCredentials(
      app,
      secondary.email,
      secondary.password,
    );

    let caminhaoB;
    try {
      caminhaoB = await createCaminhaoViaApi(app, tenantB.authHeader, {
        placa: `B${Date.now().toString().slice(-6)}`,
      });

      const listA = await request(app)
        .get("/api/caminhoes")
        .query({ page: 1, limit: 50 })
        .set(tenantA.authHeader);

      assert.equal(listA.status, 200);
      assert.ok(
        !listA.body.data.some((c) => c.id === caminhaoB.id),
        "tenant A não deve ver caminhão do tenant B",
      );

      const getA = await request(app)
        .get(`/api/caminhoes/${caminhaoB.placa}`)
        .set(tenantA.authHeader);

      assert.notEqual(getA.status, 200);
    } finally {
      await cleanupCaminhao(caminhaoB?.id);
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "mesma placa permitida em tenants diferentes",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const tenantA = await loginAsAdmin(app);
    const secondary = await createSecondaryTenantAdmin();
    const tenantB = await loginWithCredentials(
      app,
      secondary.email,
      secondary.password,
    );

    const placa = `P${Date.now().toString().slice(-6)}`;
    let caminhaoA;
    let caminhaoB;

    try {
      caminhaoA = await createCaminhaoViaApi(app, tenantA.authHeader, { placa });
      caminhaoB = await createCaminhaoViaApi(app, tenantB.authHeader, { placa });

      assert.notEqual(caminhaoA.id, caminhaoB.id);
      assert.equal(caminhaoA.placa.toUpperCase(), caminhaoB.placa.toUpperCase());
      assert.equal(caminhaoA.tenant_id, tenantA.tenantId);
      assert.equal(caminhaoB.tenant_id, tenantB.tenantId);
    } finally {
      await cleanupCaminhao(caminhaoA?.id);
      await cleanupCaminhao(caminhaoB?.id);
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "e-mail único global: não cria segundo usuário com mesmo e-mail",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    await loginAsAdmin(app);
    const email = (process.env.ADMIN_EMAIL || "").toLowerCase();

    const tenant = await prisma.tenants.findFirst({ where: { slug: "abbroto" } });
    await assert.rejects(
      () =>
        prisma.users.create({
          data: {
            tenant_id: tenant.id,
            email,
            nome: "Duplicado",
            role: "operator",
            password_hash: "x",
            ativo: true,
          },
        }),
      /Unique constraint|unique/i,
    );
  },
);

test(
  "tenant A não vê gasto do tenant B",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { ensureRegistroLookups } = await import(
      "../helpers/dbTestFixtures.js"
    );
    const tenantA = await loginAsAdmin(app);
    const secondary = await createSecondaryTenantAdmin();
    const tenantB = await loginWithCredentials(
      app,
      secondary.email,
      secondary.password,
    );
    const { tipoGastoId } = await ensureRegistroLookups();

    let caminhaoB;
    let gastoId;

    try {
      caminhaoB = await createCaminhaoViaApi(app, tenantB.authHeader);

      const gastoRes = await request(app)
        .post("/api/gastos")
        .set(tenantB.authHeader)
        .send({
          caminhao_id: caminhaoB.id,
          tipo_gasto_id: tipoGastoId,
          data_gasto: "2026-07-01",
          valor: 123,
        });

      assert.equal(gastoRes.status, 201, gastoRes.body?.error);
      gastoId = gastoRes.body.data.id;

      const getA = await request(app)
        .get(`/api/gastos/${gastoId}`)
        .set(tenantA.authHeader);

      assert.notEqual(getA.status, 200);
    } finally {
      if (gastoId) {
        await prisma.gastos.delete({ where: { id: gastoId } }).catch(() => {});
      }
      await cleanupCaminhao(caminhaoB?.id);
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "manutenção do tenant B não vaza para o tenant A",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { ensureRegistroLookups } = await import(
      "../helpers/dbTestFixtures.js"
    );
    const tenantA = await loginAsAdmin(app);
    const secondary = await createSecondaryTenantAdmin({
      slug: `manut-${Date.now().toString(36)}`,
      email: `manut-${Date.now().toString(36)}@tenant.local`,
    });
    const tenantB = await loginWithCredentials(
      app,
      secondary.email,
      secondary.password,
    );
    const { itemChecklistId } = await ensureRegistroLookups();

    let caminhaoA;
    let caminhaoB;
    let checklistBId;

    try {
      caminhaoA = await createCaminhaoViaApi(app, tenantA.authHeader, {
        placa: `MA${Date.now().toString().slice(-5)}`,
      });
      caminhaoB = await createCaminhaoViaApi(app, tenantB.authHeader, {
        placa: `MB${Date.now().toString().slice(-5)}`,
      });

      const createB = await request(app)
        .post("/api/checklist")
        .set(tenantB.authHeader)
        .send({
          caminhao_id: caminhaoB.id,
          item_id: itemChecklistId,
          data_manutencao: "2026-07-10",
          km_manutencao: 51000,
          valor: 250,
          observacao: "Manutenção exclusiva tenant B",
        });

      assert.equal(createB.status, 201, createB.body?.error);
      checklistBId = createB.body.data.id;
      assert.equal(createB.body.data.tenant_id, tenantB.tenantId);

      const getByIdA = await request(app)
        .get(`/api/checklist/${checklistBId}`)
        .set(tenantA.authHeader);
      assert.notEqual(
        getByIdA.status,
        200,
        "tenant A não deve abrir manutenção do tenant B por id",
      );

      const listA = await request(app)
        .get("/api/checklist")
        .query({ page: 1, limit: 100 })
        .set(tenantA.authHeader);
      assert.equal(listA.status, 200);
      assert.ok(
        !listA.body.data.some((row) => row.id === checklistBId),
        "lista geral de manutenção do tenant A não pode incluir item do B",
      );

      const byCaminhaoA = await request(app)
        .get(`/api/checklist/caminhao/${caminhaoB.id}`)
        .set(tenantA.authHeader);
      assert.equal(byCaminhaoA.status, 200);
      assert.ok(
        !byCaminhaoA.body.data.some((row) => row.id === checklistBId),
        "tenant A não deve listar manutenção pelo caminhão do tenant B",
      );

      const registrosA = await request(app)
        .get("/api/registros")
        .query({ page: 1, limit: 100 })
        .set(tenantA.authHeader);
      assert.equal(registrosA.status, 200);
      const rows = Array.isArray(registrosA.body.data)
        ? registrosA.body.data
        : registrosA.body.data?.items || [];
      assert.ok(
        !rows.some(
          (row) =>
            row.id === checklistBId ||
            row.observacao === "Manutenção exclusiva tenant B",
        ),
        "registros do tenant A não podem trazer manutenção do tenant B",
      );

      const overviewA = await request(app)
        .get("/api/reports/overview")
        .set(tenantA.authHeader);
      assert.equal(overviewA.status, 200);

      const createCross = await request(app)
        .post("/api/checklist")
        .set(tenantA.authHeader)
        .send({
          caminhao_id: caminhaoB.id,
          item_id: itemChecklistId,
          data_manutencao: "2026-07-11",
          km_manutencao: 52000,
          valor: 10,
        });
      assert.notEqual(
        createCross.status,
        201,
        "tenant A não pode criar manutenção no caminhão do tenant B",
      );

      const updateCross = await request(app)
        .put(`/api/checklist/${checklistBId}`)
        .set(tenantA.authHeader)
        .send({ valor: 9999 });
      assert.notEqual(
        updateCross.status,
        200,
        "tenant A não pode editar manutenção do tenant B",
      );

      const deleteCross = await request(app)
        .delete(`/api/checklist/${checklistBId}`)
        .set(tenantA.authHeader);
      assert.notEqual(
        deleteCross.status,
        200,
        "tenant A não pode apagar manutenção do tenant B",
      );

      const stillB = await request(app)
        .get(`/api/checklist/${checklistBId}`)
        .set(tenantB.authHeader);
      assert.equal(stillB.status, 200);
      assert.equal(stillB.body.data.id, checklistBId);
      assert.equal(Number(stillB.body.data.valor), 250);
    } finally {
      if (checklistBId) {
        await prisma.checklist
          .delete({ where: { id: checklistBId } })
          .catch(() => {});
      }
      await cleanupCaminhao(caminhaoA?.id);
      await cleanupCaminhao(caminhaoB?.id);
      await cleanupTenant(secondary.tenant.id);
    }
  },
);
