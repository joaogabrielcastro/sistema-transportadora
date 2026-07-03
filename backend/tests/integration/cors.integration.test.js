import "../helpers/env/authEnabled.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";

const FRONTEND_ORIGIN = "http://localhost:5173";

test("OPTIONS /api/reports/overview responde preflight com CORS", async () => {
  const res = await request(app)
    .options("/api/reports/overview")
    .set("Origin", FRONTEND_ORIGIN)
    .set("Access-Control-Request-Method", "GET")
    .set("Access-Control-Request-Headers", "authorization,content-type");

  assert.equal(res.status, 204);
  assert.equal(res.headers["access-control-allow-origin"], FRONTEND_ORIGIN);
  assert.match(
    String(res.headers["access-control-allow-headers"] || "").toLowerCase(),
    /authorization/,
  );
});

test("GET /api/reports/overview inclui CORS mesmo com 401 sem token", async () => {
  const res = await request(app)
    .get("/api/reports/overview")
    .set("Origin", FRONTEND_ORIGIN);

  assert.equal(res.status, 401);
  assert.equal(res.headers["access-control-allow-origin"], FRONTEND_ORIGIN);
});
