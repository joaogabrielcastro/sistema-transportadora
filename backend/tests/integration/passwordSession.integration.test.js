/**
 * Confirma que alterar a senha invalida JWTs emitidos antes (claim `sv`).
 */
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";
import { loginAsAdmin } from "../helpers/dbTestFixtures.js";
import prisma from "../../src/lib/prisma.js";
import {
  AUTH_TOKEN_PURPOSE,
  AUTH_TOKEN_TTL,
  generateAuthToken,
} from "../../src/utils/authTokens.js";

test(
  "POST /api/auth/change-password invalida o JWT anterior",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { token, user, authHeader } = await loginAsAdmin(app);
    const meBefore = await request(app).get("/api/auth/me").set(authHeader);
    assert.equal(meBefore.status, 200);

    const currentPassword = process.env.ADMIN_PASSWORD;
    const newPassword = `${currentPassword}-rotated-1`;

    const changeRes = await request(app)
      .post("/api/auth/change-password")
      .set(authHeader)
      .send({ currentPassword, newPassword });
    assert.equal(changeRes.status, 200, changeRes.body?.error);

    const meAfter = await request(app).get("/api/auth/me").set(authHeader);
    assert.equal(meAfter.status, 401);

    const loginNew = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: newPassword,
    });
    assert.equal(loginNew.status, 200);
    const newHeader = {
      Authorization: `Bearer ${loginNew.body.data.token}`,
    };
    const meOk = await request(app).get("/api/auth/me").set(newHeader);
    assert.equal(meOk.status, 200);

    // Restaura senha original para os demais testes da suíte.
    const restore = await request(app)
      .post("/api/auth/change-password")
      .set(newHeader)
      .send({ currentPassword: newPassword, newPassword: currentPassword });
    assert.equal(restore.status, 200, restore.body?.error);
  },
);

test(
  "POST /api/auth/reset-password invalida JWT emitido antes do reset",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { token, user, authHeader } = await loginAsAdmin(app);
    assert.ok(token);

    const meBefore = await request(app).get("/api/auth/me").set(authHeader);
    assert.equal(meBefore.status, 200);

    const { raw, hash } = generateAuthToken();
    await prisma.auth_tokens.create({
      data: {
        purpose: AUTH_TOKEN_PURPOSE.RESET,
        email: user.email,
        tenant_id: user.tenantId,
        user_id: user.id,
        token_hash: hash,
        expires_at: new Date(Date.now() + AUTH_TOKEN_TTL.RESET_MS),
      },
    });

    const nextPassword = `${process.env.ADMIN_PASSWORD}-via-reset`;
    const resetRes = await request(app).post("/api/auth/reset-password").send({
      token: raw,
      password: nextPassword,
    });
    assert.equal(resetRes.status, 200, resetRes.body?.error);

    const meAfter = await request(app).get("/api/auth/me").set(authHeader);
    assert.equal(meAfter.status, 401);

    const loginNew = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: nextPassword,
    });
    assert.equal(loginNew.status, 200);
    const newHeader = {
      Authorization: `Bearer ${loginNew.body.data.token}`,
    };

    const restore = await request(app)
      .post("/api/auth/change-password")
      .set(newHeader)
      .send({
        currentPassword: nextPassword,
        newPassword: process.env.ADMIN_PASSWORD,
      });
    assert.equal(restore.status, 200, restore.body?.error);
  },
);
