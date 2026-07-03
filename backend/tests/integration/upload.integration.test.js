import { rmSync } from "node:fs";
import { shouldRunDbTests } from "../helpers/env/dbIntegration.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import { minimalPdfBuffer } from "../helpers/testConstants.js";

test.after(() => {
  if (process.env.UPLOADS_DIR) {
    rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  }
});

test(
  "fluxo documento PDF: criar caminhão, upload, listar e excluir",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const placa = `TST${Date.now().toString().slice(-4)}`;

    const createRes = await request(app).post("/api/caminhoes").send({
      placa,
      qtd_pneus: 6,
      km_atual: 1000,
    });
    assert.equal(createRes.status, 201, createRes.body?.error || "create failed");

    const uploadRes = await request(app)
      .post(`/api/caminhoes/${placa}/documentos`)
      .attach("arquivos", minimalPdfBuffer, {
        filename: "crlv-teste.pdf",
        contentType: "application/pdf",
      });
    assert.equal(uploadRes.status, 201, uploadRes.body?.error || "upload failed");

    const listRes = await request(app).get(`/api/caminhoes/${placa}/documentos`);
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.data));
    assert.ok(listRes.body.data.length >= 1);

    const docId = listRes.body.data[0].id;
    const deleteRes = await request(app).delete(
      `/api/caminhoes/${placa}/documentos/${docId}`,
    );
    assert.equal(deleteRes.status, 200);
  },
);

test(
  "POST /api/ordem-coleta/enviar enfileira job (202)",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1 ou rode no CI" },
  async () => {
    const res = await request(app)
      .post("/api/ordem-coleta/enviar")
      .send({
        tipo: "PADRAO",
        placa: null,
        emailDestinatario: "destino-teste@example.com",
        dadosVariaveis: { mercadoria: "Teste fila" },
      });

    assert.equal(res.status, 202);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data?.id);
    assert.equal(res.body.data?.status, "processing");

    const statusRes = await request(app).get(
      `/api/ordem-coleta/envio/${res.body.data.id}`,
    );
    assert.equal(statusRes.status, 200);
    assert.ok(["processing", "sent", "failed"].includes(statusRes.body.data?.status));
  },
);
