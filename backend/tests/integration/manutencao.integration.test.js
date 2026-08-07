import { rmSync } from "node:fs";
import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import prisma from "../../src/lib/prisma.js";
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
  "fluxo CRUD de gasto com sincronização de KM",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const { tipoGastoId } = await ensureRegistroLookups();
    const caminhao = await createCaminhaoViaApi(app, authHeader, {
      km_atual: 48000,
    });

    try {
      const createRes = await request(app)
        .post("/api/gastos")
        .set(authHeader)
        .send({
          caminhao_id: caminhao.id,
          tipo_gasto_id: tipoGastoId,
          data_gasto: "2026-07-01",
          valor: 850.5,
          descricao: "Abastecimento teste",
          km_registro: 51000,
        });

      assert.equal(createRes.status, 201, createRes.body?.error || "create gasto");
      const gastoId = createRes.body.data.id;

      const getRes = await request(app)
        .get(`/api/gastos/${gastoId}`)
        .set(authHeader);
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.data.descricao, "Abastecimento teste");

      const updateRes = await request(app)
        .put(`/api/gastos/${gastoId}`)
        .set(authHeader)
        .send({ valor: 900, descricao: "Abastecimento atualizado" });
      assert.equal(updateRes.status, 200);
      assert.equal(Number(updateRes.body.data.valor), 900);

      const caminhaoDb = await prisma.caminhoes.findUnique({
        where: { id: caminhao.id },
      });
      assert.equal(caminhaoDb.km_atual, 51000);

      const deleteRes = await request(app)
        .delete(`/api/gastos/${gastoId}`)
        .set(authHeader);
      assert.equal(deleteRes.status, 204);
    } finally {
      await cleanupCaminhao(caminhao.id);
    }
  },
);

test(
  "fluxo CRUD de checklist (manutenção)",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const { itemChecklistId } = await ensureRegistroLookups();
    const caminhao = await createCaminhaoViaApi(app, authHeader);

    try {
      const createRes = await request(app)
        .post("/api/checklist")
        .set(authHeader)
        .send({
          caminhao_id: caminhao.id,
          item_id: itemChecklistId,
          data_manutencao: "2026-07-02",
          km_manutencao: 52000,
          valor: 1200,
          observacao: "Troca de óleo teste",
          oficina: "Oficina Integração",
        });

      assert.equal(
        createRes.status,
        201,
        createRes.body?.error || "create checklist",
      );
      const checklistId = createRes.body.data.id;

      const listRes = await request(app)
        .get(`/api/checklist/caminhao/${caminhao.id}`)
        .set(authHeader);
      assert.equal(listRes.status, 200);
      assert.ok(listRes.body.data.some((c) => c.id === checklistId));

      const updateRes = await request(app)
        .put(`/api/checklist/${checklistId}`)
        .set(authHeader)
        .send({ valor: 1350 });
      assert.equal(updateRes.status, 200);
      assert.equal(Number(updateRes.body.data.valor), 1350);

      const deleteRes = await request(app)
        .delete(`/api/checklist/${checklistId}`)
        .set(authHeader);
      assert.equal(deleteRes.status, 204);
    } finally {
      await cleanupCaminhao(caminhao.id);
    }
  },
);

test(
  "checklist com proxima_km gera alerta de manutenção",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    const caminhao = await createCaminhaoViaApi(app, authHeader, {
      km_atual: 100000,
    });

    let checklistId;
    try {
      const createRes = await request(app)
        .post("/api/checklist")
        .set(authHeader)
        .send({
          caminhao_id: caminhao.id,
          nome_item: "Troca de óleo",
          data_manutencao: "2026-07-02",
          km_manutencao: 90000,
          valor: 500,
          proxima_km: 95000,
          proxima_data: "2026-07-10",
        });

      assert.equal(
        createRes.status,
        201,
        createRes.body?.error || "create checklist com lembrete",
      );
      checklistId = createRes.body.data.id;
      assert.equal(createRes.body.data.proxima_km, 95000);

      const getRes = await request(app)
        .get(`/api/checklist/${checklistId}`)
        .set(authHeader);
      assert.equal(getRes.status, 200);
      assert.equal(getRes.body.data.proxima_km, 95000);
      assert.ok(getRes.body.data.proxima_data);

      const alertsRes = await request(app)
        .get("/api/ops/alerts")
        .set(authHeader);
      assert.equal(alertsRes.status, 200, alertsRes.body?.error || "alerts");
      const alerts = alertsRes.body.data?.alerts || [];
      const manutKm = alerts.find(
        (a) => a.id === `manut-km-${checklistId}` || a.type === "manut_km_due",
      );
      assert.ok(
        manutKm,
        `esperava alerta de manutenção por KM; tipos: ${alerts.map((a) => a.type).join(",")}`,
      );
      assert.equal(manutKm.severity, "critical");
      assert.match(manutKm.title, /óleo|Manutenção/i);

      const updateRes = await request(app)
        .put(`/api/checklist/${checklistId}`)
        .set(authHeader)
        .send({
          proxima_km: 200000,
          proxima_data: "2099-01-01",
        });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.data.proxima_km, 200000);

      const alertsAfter = await request(app)
        .get("/api/ops/alerts")
        .set(authHeader);
      const stillDue = (alertsAfter.body.data?.alerts || []).find(
        (a) => a.id === `manut-km-${checklistId}`,
      );
      assert.equal(stillDue, undefined);
    } finally {
      if (checklistId) {
        await prisma.checklist.deleteMany({ where: { id: checklistId } });
      }
      await cleanupCaminhao(caminhao.id);
    }
  },
);
