import test from "node:test";
import assert from "node:assert/strict";
import { notaManualSchema } from "../../src/schemas/notaFiscalSchema.js";

test("notaManualSchema aceita cadastro mínimo", () => {
  const parsed = notaManualSchema.parse({
    numero: "597",
    serie: "1",
    emitente: "OXIDAKAR",
    data_emissao: "2026-08-12",
    itens: [
      {
        descricao: "FILTRO",
        quantidade: 1,
        valor_unitario: 853.19,
      },
    ],
  });
  assert.equal(parsed.numero, "597");
  assert.equal(parsed.itens[0].descricao, "FILTRO");
  assert.equal(parsed.caminhao_id ?? null, null);
});

test("notaManualSchema rejeita nota sem item", () => {
  assert.throws(
    () =>
      notaManualSchema.parse({
        numero: "1",
        emitente: "FORNECEDOR",
        itens: [],
      }),
    /ao menos um item/i,
  );
});
