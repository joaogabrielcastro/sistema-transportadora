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
  "GET /api/registros retorna gastos e manutenções paginados",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader, tenantId } = await loginAsAdmin(app);
    const { tipoGastoId, itemChecklistId } = await ensureRegistroLookups();
    const caminhao = await createCaminhaoViaApi(app, authHeader);

    try {
      await prisma.gastos.create({
        data: {
          tenant_id: tenantId,
          caminhao_id: caminhao.id,
          tipo_gasto_id: tipoGastoId,
          data_gasto: new Date("2026-07-01"),
          valor: 1500.5,
          descricao: "Teste integração gasto",
          km_registro: 50100,
        },
      });

      await prisma.checklist.create({
        data: {
          tenant_id: tenantId,
          caminhao_id: caminhao.id,
          item_id: itemChecklistId,
          data_manutencao: new Date("2026-07-02"),
          km_manutencao: 50200,
          valor: 800,
          observacao: "Teste integração checklist",
          oficina: "Oficina Teste",
        },
      });

      const res = await request(app)
        .get("/api/registros")
        .query({ page: 1, limit: 10, caminhaoId: caminhao.id })
        .set(authHeader);

      assert.equal(res.status, 200, res.body?.error || "list failed");
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 2);
      assert.ok(res.body.pagination);
      assert.equal(res.body.pagination.currentPage, 1);

      const tipos = new Set(res.body.data.map((r) => r.tipo_registro));
      assert.ok(tipos.has("Gasto"));
      assert.ok(tipos.has("Manutenção"));
    } finally {
      await cleanupCaminhao(caminhao.id);
    }
  },
);

test(
  "GET /api/registros filtra por placa",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader, tenantId } = await loginAsAdmin(app);
    const { tipoGastoId } = await ensureRegistroLookups();
    const caminhao = await createCaminhaoViaApi(app, authHeader);

    try {
      await prisma.gastos.create({
        data: {
          tenant_id: tenantId,
          caminhao_id: caminhao.id,
          tipo_gasto_id: tipoGastoId,
          data_gasto: new Date("2026-06-15"),
          valor: 200,
          descricao: "Filtro por placa",
        },
      });

      const res = await request(app)
        .get("/api/registros")
        .query({ page: 1, limit: 5, placa: caminhao.placa })
        .set(authHeader);

      assert.equal(res.status, 200);
      assert.ok(
        res.body.data.every(
          (r) =>
            String(r.placa || "").toUpperCase() ===
            String(caminhao.placa).toUpperCase(),
        ),
      );
    } finally {
      await cleanupCaminhao(caminhao.id);
    }
  },
);
