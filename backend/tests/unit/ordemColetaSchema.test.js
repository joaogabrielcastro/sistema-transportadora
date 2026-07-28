import test from "node:test";
import assert from "node:assert/strict";
import {
  ordemColetaPreviewSchema,
  ordemColetaEnviarSchema,
  ordemColetaHistoricoQuerySchema,
} from "../../src/schemas/ordemColetaSchema.js";

test("ordemColetaPreviewSchema aceita payload PADRAO mínimo", () => {
  const parsed = ordemColetaPreviewSchema.parse({
    tipo: "PADRAO",
    placa: null,
    dadosVariaveis: { mercadoria: "Soja" },
  });

  assert.equal(parsed.tipo, "PADRAO");
  assert.equal(parsed.placa, null);
  assert.equal(parsed.dadosVariaveis.mercadoria, "Soja");
});

test("ordemColetaPreviewSchema rejeita tipo inválido", () => {
  assert.throws(() =>
    ordemColetaPreviewSchema.parse({ tipo: "OUTRO", placa: null }),
  );
});

test("ordemColetaEnviarSchema exige e-mail válido", () => {
  assert.throws(() =>
    ordemColetaEnviarSchema.parse({
      tipo: "PADRAO",
      emailDestinatario: "email-invalido",
    }),
  );

  const parsed = ordemColetaEnviarSchema.parse({
    tipo: "PADRAO",
    emailDestinatario: "cliente@exemplo.com",
  });
  assert.equal(parsed.emailDestinatario, "cliente@exemplo.com");
});

test("ordemColetaHistoricoQuerySchema limita page size", () => {
  assert.throws(() =>
    ordemColetaHistoricoQuerySchema.parse({ limit: 100 }),
  );

  const parsed = ordemColetaHistoricoQuerySchema.parse({ page: 2, limit: 20 });
  assert.equal(parsed.page, 2);
  assert.equal(parsed.limit, 20);
});
