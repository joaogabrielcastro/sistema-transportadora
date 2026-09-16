import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyTipoGasto,
  sanitizeGastoDetalhes,
} from "../../src/utils/gastoDetalhes.js";
import { gastoSchema } from "../../src/schemas/gastoSchema.js";

test("classifyTipoGasto reconhece multa, pedágio e demais", () => {
  assert.equal(classifyTipoGasto("Multa"), "multa");
  assert.equal(classifyTipoGasto("Pedágio"), "pedagio");
  assert.equal(classifyTipoGasto("IPVA / Licenciamento"), "ipva");
  assert.equal(classifyTipoGasto("Combustível"), "combustivel");
  assert.equal(classifyTipoGasto("Customizado"), "outros");
});

test("sanitizeGastoDetalhes descarta vazio e corta chave/valor", () => {
  assert.equal(sanitizeGastoDetalhes(null), null);
  assert.equal(sanitizeGastoDetalhes({}), null);
  assert.deepEqual(
    sanitizeGastoDetalhes({ numero_ait: " E123 ", orgao: "", pontos: 7 }),
    { numero_ait: "E123", pontos: 7 },
  );
});

test("gastoSchema aceita multa com controle e detalhes", () => {
  const parsed = gastoSchema.parse({
    caminhao_id: 1,
    tipo_gasto_id: 3,
    data_gasto: "2026-09-01",
    valor: 293.4,
    motorista_id: 9,
    status_pagamento: "pendente",
    data_vencimento: "2026-10-15",
    detalhes: { numero_ait: "PRF123", orgao: "PRF", uf: "SP" },
  });
  assert.equal(parsed.status_pagamento, "pendente");
  assert.equal(parsed.motorista_id, 9);
  assert.equal(parsed.detalhes.numero_ait, "PRF123");
});

test("gastoSchema rejeita status de pagamento inválido", () => {
  assert.throws(() =>
    gastoSchema.parse({
      caminhao_id: 1,
      tipo_gasto_id: 3,
      data_gasto: "2026-09-01",
      valor: 10,
      status_pagamento: "atrasado",
    }),
  );
});
