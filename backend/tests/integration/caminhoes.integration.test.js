import { rmSync } from "node:fs";
import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import {
  loginAsAdmin,
  createCaminhaoViaApi,
  testPlaca,
  cleanupCaminhao,
} from "../helpers/dbTestFixtures.js";

test.after(() => {
  if (process.env.UPLOADS_DIR) {
    rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  }
});

test(
  "GET /api/caminhoes com paginação retorna metadados",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const caminhao = await createCaminhaoViaApi(app, authHeader);

    try {
      const res = await request(app)
        .get("/api/caminhoes")
        .query({ page: 1, limit: 5 })
        .set(authHeader);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.equal(res.body.pagination.currentPage, 1);
      assert.equal(res.body.pagination.itemsPerPage, 5);
      assert.ok(res.body.pagination.totalItems >= 1);
    } finally {
      await cleanupCaminhao(caminhao.id);
    }
  },
);

test(
  "GET /api/caminhoes/search filtra por termo",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const placa = testPlaca("SRC");
    const caminhao = await createCaminhaoViaApi(app, authHeader, {
      placa,
      motorista: "Motorista Busca Teste",
    });

    try {
      const res = await request(app)
        .get("/api/caminhoes/search")
        .query({ term: placa.slice(0, 4) })
        .set(authHeader);

      assert.equal(res.status, 200);
      assert.ok(
        res.body.data.some((c) => c.placa.toUpperCase() === placa.toUpperCase()),
      );
    } finally {
      await cleanupCaminhao(caminhao.id);
    }
  },
);

test(
  "PUT /api/caminhoes/:placa atualiza dados do veículo",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const caminhao = await createCaminhaoViaApi(app, authHeader);

    try {
      const res = await request(app)
        .put(`/api/caminhoes/${caminhao.placa}`)
        .set(authHeader)
        .send({ motorista: "João Atualizado", km_atual: 55000 });

      assert.equal(res.status, 200, res.body?.error || "update failed");
      assert.equal(res.body.data.motorista, "João Atualizado");
      assert.equal(res.body.data.km_atual, 55000);
    } finally {
      await cleanupCaminhao(caminhao.id);
    }
  },
);
