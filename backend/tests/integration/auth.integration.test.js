import "../helpers/env/authEnabled.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import { TEST_API_TOKEN } from "../helpers/testConstants.js";

test("GET /api/caminhoes retorna 401 sem Authorization", async () => {
  const res = await request(app).get("/api/caminhoes");
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("GET /api/caminhoes retorna 401 com token inválido", async () => {
  const res = await request(app)
    .get("/api/caminhoes")
    .set("Authorization", "Bearer token-invalido-teste");
  assert.equal(res.status, 401);
});

test("GET /api/caminhoes aceita Bearer válido", async () => {
  const res = await request(app)
    .get("/api/caminhoes")
    .set("Authorization", `Bearer ${TEST_API_TOKEN}`);

  assert.notEqual(res.status, 401);
});

test("GET /health permanece público sem token", async () => {
  const res = await request(app).get("/health");
  assert.ok([200, 503].includes(res.status));
  assert.ok(res.body.status);
});
