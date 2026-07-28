import { rmSync } from "node:fs";
import {
  shouldRunDbTests,
} from "../helpers/env/jwtAuthDb.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import {
  loginAsAdmin,
  createCaminhaoViaApi,
} from "../helpers/dbTestFixtures.js";

test.after(() => {
  if (process.env.UPLOADS_DIR) {
    rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  }
});

test(
  "POST /api/auth/login rejeita credenciais inválidas",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "naoexiste@abbroto.local",
      password: "senha-errada-123",
    });

    assert.notEqual(res.status, 200);
    assert.equal(res.body.success, false);
  },
);

test(
  "POST /api/auth/login retorna JWT e GET /api/auth/me aceita o token",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { token, user, authHeader } = await loginAsAdmin(app);

    assert.ok(user?.email);
    assert.match(token, /^[\w-]+\.[\w-]+\.[\w-]+$/);

    const meRes = await request(app).get("/api/auth/me").set(authHeader);
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.data.email, user.email);

    const protectedRes = await request(app)
      .get("/api/caminhoes")
      .set(authHeader);
    assert.equal(protectedRes.status, 200);
    assert.equal(protectedRes.body.success, true);
  },
);

test(
  "GET /api/caminhoes retorna 401 com JWT inválido",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const res = await request(app)
      .get("/api/caminhoes")
      .set("Authorization", "Bearer jwt.invalido.teste");

    assert.equal(res.status, 401);
  },
);

test(
  "POST /api/caminhoes exige autenticação JWT",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const res = await request(app).post("/api/caminhoes").send({
      placa: "SEMJWT1",
      qtd_pneus: 6,
    });
    assert.equal(res.status, 401);
  },
);

test(
  "fluxo autenticado: criar caminhão com JWT",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const caminhao = await createCaminhaoViaApi(app, authHeader);

    assert.ok(caminhao.id);
    assert.ok(caminhao.placa);

    const listRes = await request(app)
      .get("/api/caminhoes")
      .set(authHeader);
    assert.equal(listRes.status, 200);
    assert.ok(
      extractApiArray(listRes.body).some((c) => c.placa === caminhao.placa),
    );

    await request(app)
      .delete(`/api/caminhoes/${caminhao.placa}/cascade`)
      .set(authHeader);
  },
);

function extractApiArray(body) {
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.data?.data)) return body.data.data;
  return [];
}
