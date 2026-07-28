import { rmSync } from "node:fs";
import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import {
  loginAsAdmin,
  cleanupOrdemEnvios,
} from "../helpers/dbTestFixtures.js";

test.after(() => {
  if (process.env.UPLOADS_DIR) {
    rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  }
});

test(
  "POST /api/ordem-coleta/enviar enfileira job e GET status retorna processing",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const { authHeader } = await loginAsAdmin(app);
    let envioId;

    try {
      const enviarRes = await request(app)
        .post("/api/ordem-coleta/enviar")
        .set(authHeader)
        .send({
          tipo: "PADRAO",
          placa: null,
          dadosVariaveis: { mercadoria: "Teste integração envio" },
          emailDestinatario: "destino@test.local",
        });

      assert.equal(enviarRes.status, 202, enviarRes.body?.error || "enviar");
      assert.equal(enviarRes.body.success, true);
      envioId = enviarRes.body.data?.id;
      assert.ok(envioId);

      const statusRes = await request(app)
        .get(`/api/ordem-coleta/envio/${envioId}`)
        .set(authHeader);

      assert.equal(statusRes.status, 200);
      assert.ok(["processing", "sent", "failed"].includes(statusRes.body.data?.status));

      const historicoRes = await request(app)
        .get("/api/ordem-coleta/historico")
        .query({ page: 1, limit: 5 })
        .set(authHeader);

      assert.equal(historicoRes.status, 200);
      assert.ok(Array.isArray(historicoRes.body.data));
      assert.ok(
        historicoRes.body.data.some((row) => row.id === envioId),
        "envio aparece no histórico",
      );
    } finally {
      if (envioId) {
        await cleanupOrdemEnvios([envioId]);
      }
    }
  },
);
