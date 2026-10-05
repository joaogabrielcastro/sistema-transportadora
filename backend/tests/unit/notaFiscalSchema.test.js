import test from "node:test";
import assert from "node:assert/strict";
import {
  notaManualSchema,
  notaImportSchema,
} from "../../src/schemas/notaFiscalSchema.js";

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

test("notaImportSchema aceita XML sem emitente", () => {
  const parsed = notaImportSchema.parse({
    numero: "435",
    serie: "1",
    emitente: null,
    chave_acesso: null,
    itens: [{ descricao: "FILTRO", quantidade: 2, valor_unitario: 10 }],
  });
  assert.equal(parsed.numero, "435");
  assert.equal(parsed.emitente, null);
});

test("notaImportSchema aceita data_emissao ISO da NF-e (round-trip do preview)", () => {
  const parsed = notaImportSchema.parse({
    numero: "2467560",
    serie: "3",
    emitente: "FORNECEDOR NF-e",
    data_emissao: "2026-10-05T10:30:00-03:00",
    itens: [{ descricao: "PEÇA", quantidade: 1, valor_unitario: 100 }],
  });
  assert.equal(parsed.data_emissao, "2026-10-05");
});

test("notaImportSchema aceita data_emissao ISO UTC serializada de Date", () => {
  const parsed = notaImportSchema.parse({
    numero: "1",
    emitente: "FORNECEDOR",
    data_emissao: "2026-08-05T13:00:00.000Z",
    itens: [{ descricao: "FILTRO", quantidade: 1 }],
  });
  assert.equal(parsed.data_emissao, "2026-08-05");
});

test("notaImportSchema rejeita chave incompleta", () => {
  assert.throws(
    () =>
      notaImportSchema.parse({
        numero: "1",
        emitente: "FORNECEDOR",
        chave_acesso: "123",
        itens: [{ descricao: "FILTRO", quantidade: 1 }],
      }),
    /44 dígitos/i,
  );
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
