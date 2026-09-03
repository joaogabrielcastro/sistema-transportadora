import { rmSync } from "node:fs";
import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
import { hashPassword } from "../../src/utils/password.js";
import {
  createSecondaryTenantAdmin,
  loginWithCredentials,
  cleanupTenant,
} from "../helpers/dbTestFixtures.js";

test.after(() => {
  if (process.env.UPLOADS_DIR) {
    rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  }
});

const skipDb = shouldRunDbTests
  ? false
  : "Defina RUN_DB_TESTS=1 ou rode no CI";

test(
  "GET e PATCH /api/tenant atualizam nome e avisos",
  { skip: skipDb },
  async () => {
    const stamp = Date.now().toString(36);
    const secondary = await createSecondaryTenantAdmin({
      slug: `emp-${stamp}`,
      email: `emp-${stamp}@saas.test`,
      nome: "Empresa Original",
      billingExempt: false,
      plan: "starter",
    });

    try {
      const { authHeader } = await loginWithCredentials(
        app,
        secondary.email,
        secondary.password,
      );

      const getRes = await request(app).get("/api/tenant").set(authHeader);
      assert.equal(getRes.status, 200, getRes.body?.error);
      assert.equal(getRes.body.data.nome, "Empresa Original");
      assert.equal(getRes.body.data.canClose, true);
      assert.equal(getRes.body.data.quota?.vehicles?.limit, 15);

      const patchRes = await request(app)
        .patch("/api/tenant")
        .set(authHeader)
        .send({
          nome: "Empresa Atualizada",
          alertEmail: "avisos@empresa.test",
          weeklyDigestEnabled: false,
        });
      assert.equal(patchRes.status, 200, patchRes.body?.error);
      assert.equal(patchRes.body.data.nome, "Empresa Atualizada");
      assert.equal(patchRes.body.data.alertEmail, "avisos@empresa.test");
      assert.equal(patchRes.body.data.weeklyDigestEnabled, false);
    } finally {
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "POST /api/tenant/close exige o nome e encerra login",
  { skip: skipDb },
  async () => {
    const stamp = Date.now().toString(36);
    const nome = "Frota Encerrar";
    const secondary = await createSecondaryTenantAdmin({
      slug: `close-${stamp}`,
      email: `close-${stamp}@saas.test`,
      nome,
      billingExempt: false,
      plan: "starter",
    });

    try {
      const { authHeader } = await loginWithCredentials(
        app,
        secondary.email,
        secondary.password,
      );

      const wrong = await request(app)
        .post("/api/tenant/close")
        .set(authHeader)
        .send({ confirmName: "outro nome" });
      assert.equal(wrong.status, 400);

      const closed = await request(app)
        .post("/api/tenant/close")
        .set(authHeader)
        .send({ confirmName: nome });
      assert.equal(closed.status, 200, closed.body?.error);
      assert.equal(closed.body.data.closed, true);

      const tenant = await prisma.tenants.findUnique({
        where: { id: secondary.tenant.id },
      });
      assert.equal(tenant.ativo, false);
      assert.equal(tenant.subscription_status, "canceled");

      const login = await request(app).post("/api/auth/login").send({
        email: secondary.email,
        password: secondary.password,
      });
      assert.equal(login.status, 401);
    } finally {
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "tenant isento não encerra a conta por esta API",
  { skip: skipDb },
  async () => {
    const stamp = Date.now().toString(36);
    const nome = "Cliente Isento";
    const secondary = await createSecondaryTenantAdmin({
      slug: `exclose-${stamp}`,
      email: `exclose-${stamp}@saas.test`,
      nome,
      billingExempt: true,
    });

    try {
      const { authHeader } = await loginWithCredentials(
        app,
        secondary.email,
        secondary.password,
      );

      const getRes = await request(app).get("/api/tenant").set(authHeader);
      assert.equal(getRes.body.data.canClose, false);

      const closed = await request(app)
        .post("/api/tenant/close")
        .set(authHeader)
        .send({ confirmName: nome });
      assert.equal(closed.status, 400);
      assert.match(String(closed.body?.error || ""), /isentas/i);

      const tenant = await prisma.tenants.findUnique({
        where: { id: secondary.tenant.id },
      });
      assert.equal(tenant.ativo, true);
    } finally {
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "operador não lê nem encerra /api/tenant",
  { skip: skipDb },
  async () => {
    const stamp = Date.now().toString(36);
    const secondary = await createSecondaryTenantAdmin({
      slug: `opten-${stamp}`,
      email: `opten-admin-${stamp}@saas.test`,
      nome: "Empresa Operador",
      billingExempt: false,
      plan: "starter",
    });
    const operatorEmail = `opten-op-${stamp}@saas.test`;
    const operatorPassword = "Operador123456!";

    try {
      await prisma.users.create({
        data: {
          tenant_id: secondary.tenant.id,
          email: operatorEmail,
          nome: "Operador",
          role: "operator",
          password_hash: await hashPassword(operatorPassword),
          ativo: true,
        },
      });

      const { authHeader } = await loginWithCredentials(
        app,
        operatorEmail,
        operatorPassword,
      );

      const getRes = await request(app).get("/api/tenant").set(authHeader);
      assert.equal(getRes.status, 403);

      const closed = await request(app)
        .post("/api/tenant/close")
        .set(authHeader)
        .send({ confirmName: "Empresa Operador" });
      assert.equal(closed.status, 403);
    } finally {
      await cleanupTenant(secondary.tenant.id);
    }
  },
);
