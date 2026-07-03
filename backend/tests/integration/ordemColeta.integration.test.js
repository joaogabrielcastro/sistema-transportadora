import "../helpers/env/noAuth.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";

test("POST /api/ordem-coleta/preview gera HTML sem placa (sem DB)", async () => {
  const res = await request(app)
    .post("/api/ordem-coleta/preview")
    .send({
      tipo: "PADRAO",
      placa: null,
      dadosVariaveis: { mercadoria: "Carga teste integração" },
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.match(String(res.body.data?.html || ""), /html|DOCTYPE|mercadoria/i);
});

test("POST /api/ordem-coleta/preview rejeita payload inválido", async () => {
  const res = await request(app)
    .post("/api/ordem-coleta/preview")
    .send({ tipo: "INVALIDO" });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});
