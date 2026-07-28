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
