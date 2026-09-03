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
  createCaminhaoViaApi,
  testPlaca,
  seedCaminhoes,
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
  "cadastro público cria trial Starter com cota e aceita o primeiro caminhão",
  { skip: skipDb },
  async () => {
    const stamp = Date.now().toString(36);
    const email = `quota-reg-${stamp}@saas.test`;
    const password = "QuotaReg123456!";
    let tenantId;

    try {
      const denied = await request(app).post("/api/auth/register").send({
        empresaNome: `Quota ${stamp}`,
        nome: "Admin Quota",
        email,
        password,
        acceptedLegal: false,
      });
      assert.equal(denied.status, 400);

      const res = await request(app).post("/api/auth/register").send({
        empresaNome: `Quota ${stamp}`,
        nome: "Admin Quota",
        email,
        password,
        acceptedLegal: true,
      });
      assert.equal(res.status, 201, res.body?.error || "register failed");
      assert.ok(res.body.data?.token);
      tenantId = res.body.data.user.tenantId;
      assert.equal(res.body.data.user.plan, "starter");
      assert.equal(res.body.data.user.quota?.unlimited, false);
      assert.equal(res.body.data.user.quota?.vehicles?.limit, 15);
      assert.equal(res.body.data.user.quota?.users?.limit, 3);
      assert.equal(res.body.data.user.quota?.users?.used, 1);

      const authHeader = { Authorization: `Bearer ${res.body.data.token}` };
      const caminhao = await createCaminhaoViaApi(app, authHeader, {
        placa: testPlaca("QTA"),
      });
      assert.ok(caminhao.id);
    } finally {
      await cleanupTenant(tenantId);
    }
  },
);

test(
  "plano Starter bloqueia o 16º veículo com PLAN_QUOTA_EXCEEDED",
  { skip: skipDb },
  async () => {
    const stamp = Date.now().toString(36);
    const secondary = await createSecondaryTenantAdmin({
      slug: `quota-v-${stamp}`,
      email: `quota-v-${stamp}@saas.test`,
      nome: "Quota Veículos",
      billingExempt: false,
      plan: "starter",
    });

    try {
      const { authHeader } = await loginWithCredentials(
        app,
        secondary.email,
        secondary.password,
      );

      await seedCaminhoes(secondary.tenant.id, 15);

      const blocked = await request(app)
        .post("/api/caminhoes")
        .set(authHeader)
        .send({ placa: testPlaca("QTX"), qtd_pneus: 6, km_atual: 1000 });

      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.code, "PLAN_QUOTA_EXCEEDED");
      assert.equal(blocked.body.quota?.resource, "vehicles");
      assert.equal(blocked.body.quota?.limit, 15);
      assert.equal(blocked.body.quota?.used, 15);
    } finally {
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "plano Starter bloqueia o 4º usuário; isento não tem teto",
  { skip: skipDb },
  async () => {
    const stamp = Date.now().toString(36);
    const billed = await createSecondaryTenantAdmin({
      slug: `quota-u-${stamp}`,
      email: `quota-u-${stamp}@saas.test`,
      nome: "Quota Usuários",
      billingExempt: false,
      plan: "starter",
    });
    const exempt = await createSecondaryTenantAdmin({
      slug: `quota-ex-${stamp}`,
      email: `quota-ex-${stamp}@saas.test`,
      nome: "Quota Isento",
      billingExempt: true,
    });

    try {
      const billedAuth = await loginWithCredentials(
        app,
        billed.email,
        billed.password,
      );

      const first = await request(app)
        .post("/api/users")
        .set(billedAuth.authHeader)
        .send({
          email: `op1-${stamp}@saas.test`,
          nome: "Operador Um",
          password: "Operador123456!",
          role: "operator",
        });
      assert.equal(first.status, 201, first.body?.error);

      const second = await request(app)
        .post("/api/users")
        .set(billedAuth.authHeader)
        .send({
          email: `op2-${stamp}@saas.test`,
          nome: "Operador Dois",
          password: "Operador123456!",
          role: "viewer",
        });
      assert.equal(second.status, 201, second.body?.error);

      const blocked = await request(app)
        .post("/api/users")
        .set(billedAuth.authHeader)
        .send({
          email: `op3-${stamp}@saas.test`,
          nome: "Operador Três",
          password: "Operador123456!",
          role: "operator",
        });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.code, "PLAN_QUOTA_EXCEEDED");
      assert.equal(blocked.body.quota?.resource, "users");
      assert.equal(blocked.body.quota?.limit, 3);

      const exemptAuth = await loginWithCredentials(
        app,
        exempt.email,
        exempt.password,
      );
      for (let i = 0; i < 3; i += 1) {
        const extra = await request(app)
          .post("/api/users")
          .set(exemptAuth.authHeader)
          .send({
            email: `ex-${stamp}-${i}@saas.test`,
            nome: `Extra ${i}`,
            password: "Operador123456!",
            role: "operator",
          });
        assert.equal(extra.status, 201, extra.body?.error);
      }
    } finally {
      await cleanupTenant(billed.tenant.id);
      await cleanupTenant(exempt.tenant.id);
    }
  },
);

test(
  "isento consegue cadastrar além de 15 veículos",
  { skip: skipDb },
  async () => {
    const stamp = Date.now().toString(36);
    const secondary = await createSecondaryTenantAdmin({
      slug: `quota-ok-${stamp}`,
      email: `quota-ok-${stamp}@saas.test`,
      nome: "Quota Isento Frota",
      billingExempt: true,
    });

    try {
      const { authHeader } = await loginWithCredentials(
        app,
        secondary.email,
        secondary.password,
      );
      await seedCaminhoes(secondary.tenant.id, 15);
      const caminhao = await createCaminhaoViaApi(app, authHeader, {
        placa: testPlaca("QOK"),
      });
      assert.ok(caminhao.id);
    } finally {
      await cleanupTenant(secondary.tenant.id);
    }
  },
);

test(
  "convite pendente conta na cota de usuários",
  { skip: skipDb },
  async () => {
    const stamp = Date.now().toString(36);
    const secondary = await createSecondaryTenantAdmin({
      slug: `quota-inv-${stamp}`,
      email: `quota-inv-${stamp}@saas.test`,
      nome: "Quota Convite",
      billingExempt: false,
      plan: "starter",
    });

    try {
      await prisma.users.create({
        data: {
          tenant_id: secondary.tenant.id,
          email: `seat2-${stamp}@saas.test`,
          nome: "Segundo",
          role: "operator",
          password_hash: await hashPassword("Operador123456!"),
          ativo: true,
        },
      });
      await prisma.auth_tokens.create({
        data: {
          purpose: "invite",
          email: `convite-${stamp}@saas.test`,
          tenant_id: secondary.tenant.id,
          role: "viewer",
          nome: "Convidado",
          token_hash: `a${stamp}`.padEnd(64, "0"),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const { authHeader } = await loginWithCredentials(
        app,
        secondary.email,
        secondary.password,
      );

      const blocked = await request(app)
        .post("/api/users")
        .set(authHeader)
        .send({
          email: `op-extra-${stamp}@saas.test`,
          nome: "Extra",
          password: "Operador123456!",
          role: "operator",
        });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.code, "PLAN_QUOTA_EXCEEDED");
      assert.equal(blocked.body.quota?.used, 3);
    } finally {
      await cleanupTenant(secondary.tenant.id);
    }
  },
);
