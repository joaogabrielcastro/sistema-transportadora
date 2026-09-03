import test from "node:test";
import assert from "node:assert/strict";
import { fiscalEmpresaSchema } from "../../src/schemas/fiscalSchema.js";
import { montarPayloadCte } from "../../src/services/fiscal/CteService.js";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";

/**
 * emit.CRT / emit.IE da empresa emissora (item 1.4). Schema + bloco Emit no
 * payload de CT-e. Funções puras — sem banco.
 */

const dtoCte = emitirCteSchema.parse({
  cliente_id: 1,
  tipo_cte: "0",
  cfop: "6353",
  natureza_operacao: "Transporte",
  dt_emissao: "2026-02-01T10:00:00-03:00",
  servico: { valor_prestacao: 100 },
  tomador: { cpf_cnpj: "12345678000199" },
});

test("fiscalEmpresaSchema aceita crt (1..4) e inscricao_estadual", () => {
  const ok = fiscalEmpresaSchema.parse({
    cnpj: "12.345.678/0001-99",
    razao_social: "Transportadora X",
    crt: 3,
    inscricao_estadual: "123456789",
  });
  assert.equal(ok.crt, 3);
  assert.equal(ok.inscricao_estadual, "123456789");
});

test("fiscalEmpresaSchema rejeita crt fora de 1..4", () => {
  assert.throws(() =>
    fiscalEmpresaSchema.parse({
      cnpj: "12345678000199",
      razao_social: "X",
      crt: 9,
    }),
  );
});

test("montarPayloadCte sem empresa: Emit undefined (compat. chamada de 2 args)", () => {
  const payload = montarPayloadCte(dtoCte, undefined);
  assert.equal(payload.Emit, undefined);
  assert.equal(payload.ModeloDocumento, "57");
});

test("montarPayloadCte com empresa: Emit.CRT e Emit.IE preenchidos", () => {
  const payload = montarPayloadCte(dtoCte, undefined, {
    crt: 3,
    inscricao_estadual: "123456789",
  });
  assert.equal(payload.Emit.CRT, 3);
  assert.equal(payload.Emit.IE, "123456789");
});
