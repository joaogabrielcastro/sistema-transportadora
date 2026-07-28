import { rmSync } from "node:fs";
import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import {
  loginAsAdmin,
  ensureRegistroLookups,
  createCaminhaoViaApi,
  cleanupCaminhao,
} from "../helpers/dbTestFixtures.js";

test.after(() => {
  if (process.env.UPLOADS_DIR) {
    rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  }
});

test(
  "GET /api/reports/overview retorna totais da frota",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const { tipoGastoId } = await ensureRegistroLookups();
    const caminhao = await createCaminhaoViaApi(app, authHeader);

    try {
      await request(app)
        .post("/api/gastos")
        .set(authHeader)
        .send({
          caminhao_id: caminhao.id,
          tipo_gasto_id: tipoGastoId,
          data_gasto: "2026-07-01",
          valor: 500,
        });

      const res = await request(app)
        .get("/api/reports/overview")
        .set(authHeader);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.totalCaminhoes >= 1);
      assert.ok(Number(res.body.data.totalGastos) >= 500);
    } finally {
      await cleanupCaminhao(caminhao.id);
    }
  },
);

test(
  "GET /api/reports/cost-per-km calcula custo por KM com dados suficientes",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const { tipoGastoId } = await ensureRegistroLookups();
    const caminhao = await createCaminhaoViaApi(app, authHeader, {
      km_atual: 40000,
    });

    try {
      await request(app)
        .post("/api/gastos")
        .set(authHeader)
        .send({
          caminhao_id: caminhao.id,
          tipo_gasto_id: tipoGastoId,
          data_gasto: "2026-06-01",
          valor: 300,
          km_registro: 40000,
        });

      await request(app)
        .post("/api/gastos")
        .set(authHeader)
        .send({
          caminhao_id: caminhao.id,
          tipo_gasto_id: tipoGastoId,
          data_gasto: "2026-07-01",
          valor: 700,
          km_registro: 45000,
        });

      const res = await request(app)
        .get("/api/reports/cost-per-km")
        .query({
          startDate: "2026-06-01",
          endDate: "2026-07-31",
          caminhaoId: caminhao.id,
        })
        .set(authHeader);

      assert.equal(res.status, 200, res.body?.error || "cost-per-km failed");
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));
      assert.ok(res.body.data.items.length >= 1);

      const row = res.body.data.items.find(
        (item) => item.caminhaoId === caminhao.id,
      );
      assert.ok(row);
      assert.equal(row.kmDriven, 5000);
      assert.ok(row.costPerKm > 0);
    } finally {
      await cleanupCaminhao(caminhao.id);
    }
  },
);

test(
  "GET /api/reports/cost-per-km rejeita intervalo inválido",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);

    const res = await request(app)
      .get("/api/reports/cost-per-km")
      .query({ startDate: "data-invalida" })
      .set(authHeader);

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  },
);
