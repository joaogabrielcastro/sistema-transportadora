import { rmSync } from "node:fs";
import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import {
  loginAsAdmin,
  loginAsOperator,
  createFailedOrdemEnvio,
  cleanupOrdemEnvios,
} from "../helpers/dbTestFixtures.js";

test.after(() => {
  if (process.env.UPLOADS_DIR) {
    rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  }
});

test(
  "operador autenticado acessa GET /api/caminhoes",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsOperator(app);

    const res = await request(app).get("/api/caminhoes").set(authHeader);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  },
);

test(
  "operador recebe 403 ao apagar falhas de ordem de coleta",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsOperator(app);
    const falha = await createFailedOrdemEnvio();

    try {
      const res = await request(app)
        .delete("/api/ordem-coleta/historico/falhas")
        .set(authHeader);

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    } finally {
      await cleanupOrdemEnvios([falha.id]);
    }
  },
);

test(
  "admin pode apagar falhas de ordem de coleta",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const falha = await createFailedOrdemEnvio();

    const res = await request(app)
      .delete("/api/ordem-coleta/historico/falhas")
      .set(authHeader);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.removidos >= 1);
  },
);
