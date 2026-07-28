import { rmSync } from "node:fs";
import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import {
  loginAsAdmin,
  ensurePneuLookups,
  createCaminhaoViaApi,
  cleanupCaminhao,
  cleanupStockPneus,
} from "../helpers/dbTestFixtures.js";

test.after(() => {
  if (process.env.UPLOADS_DIR) {
    rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  }
});

test(
  "POST /api/pneus/bulk cadastra vários pneus novos no caminhão",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const { posicaoAId, posicaoBId, statusId } = await ensurePneuLookups();
    const caminhao = await createCaminhaoViaApi(app, authHeader);

    try {
      const res = await request(app)
        .post("/api/pneus/bulk")
        .set(authHeader)
        .send({
          pneus: [
            {
              caminhao_id: caminhao.id,
              marca: "Michelin",
              modelo: "X Line",
              posicao_id: posicaoAId,
              status_id: statusId,
              data_instalacao: "2026-07-06",
              km_instalacao: 50000,
            },
            {
              caminhao_id: caminhao.id,
              marca: "Bridgestone",
              modelo: "R269",
              posicao_id: posicaoBId,
              status_id: statusId,
              data_instalacao: "2026-07-06",
              km_instalacao: 50000,
            },
          ],
        });

      assert.equal(res.status, 201, res.body?.error || "bulk failed");
      assert.equal(res.body.data.length, 2);
      assert.ok(res.body.data.every((p) => p.caminhao_id === caminhao.id));

      const listRes = await request(app)
        .get(`/api/pneus/caminhao/${caminhao.id}`)
        .set(authHeader);
      assert.equal(listRes.status, 200);
      assert.ok(listRes.body.data.length >= 2);
    } finally {
      await cleanupCaminhao(caminhao.id);
    }
  },
);

test(
  "POST /api/pneus atribui pneu do estoque ao caminhão",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const { posicaoAId, statusId } = await ensurePneuLookups();
    const caminhao = await createCaminhaoViaApi(app, authHeader);
    const stockIds = [];

    try {
      const stockRes = await request(app)
        .post("/api/pneus/stock/bulk")
        .set(authHeader)
        .send({
          pneus: [
            {
              marca: "Pirelli",
              modelo: "FH01",
              status_id: statusId,
            },
          ],
        });

      assert.equal(stockRes.status, 201, stockRes.body?.error || "stock failed");
      const stockPneu = stockRes.body.data[0];
      stockIds.push(stockPneu.id);
      assert.equal(stockPneu.caminhao_id, null);

      const assignRes = await request(app)
        .post("/api/pneus")
        .set(authHeader)
        .send({
          stock_pneu_id: stockPneu.id,
          caminhao_id: caminhao.id,
          posicao_id: posicaoAId,
          status_id: statusId,
          data_instalacao: "2026-07-06",
          km_instalacao: 50000,
        });

      assert.equal(assignRes.status, 201, assignRes.body?.error || "assign failed");
      assert.equal(assignRes.body.data.caminhao_id, caminhao.id);
      assert.equal(assignRes.body.data.posicao_id, posicaoAId);
    } finally {
      await cleanupCaminhao(caminhao.id);
      await cleanupStockPneus(stockIds);
    }
  },
);
