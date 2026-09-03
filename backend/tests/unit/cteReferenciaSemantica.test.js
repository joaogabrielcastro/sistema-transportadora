import test from "node:test";
import assert from "node:assert/strict";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";
import { montarPayloadCte } from "../../src/services/fiscal/CteService.js";

/**
 * CT-e Complemento (1) vs Substituto (3) — item 1.5. Grupos infCteComp /
 * infCteSub explícitos no payload + indAlteraToma. Funções puras — sem banco.
 */

const CHAVE_ORIGINAL = "35240000000000000000000000000000000000000001";

const baseCte = {
  cliente_id: 1,
  cfop: "6353",
  natureza_operacao: "Complemento",
  dt_emissao: "2026-02-01T10:00:00-03:00",
  tomador: { cpf_cnpj: "12345678000199" },
};

test("Complemento (tipo 1): payload leva infCteComp com a chave original", () => {
  const dto = emitirCteSchema.parse({
    ...baseCte,
    tipo_cte: "1",
    cte_referenciado_id: 7,
    servico: { valor_prestacao: 50 },
  });
  const payload = montarPayloadCte(dto, CHAVE_ORIGINAL, undefined);
  assert.deepEqual(payload.infCteComp, { chave: CHAVE_ORIGINAL });
  assert.equal(payload.infCteSub, undefined);
  assert.equal(payload.ChaveCteReferenciado, CHAVE_ORIGINAL);
});

test("Substituto (tipo 3) com ind_alt_toma: payload leva infCteSub.indAlteraToma = 1", () => {
  const dto = emitirCteSchema.parse({
    ...baseCte,
    tipo_cte: "3",
    cte_referenciado_id: 7,
    ind_alt_toma: true,
    servico: { valor_prestacao: 0 },
  });
  const payload = montarPayloadCte(dto, CHAVE_ORIGINAL, undefined);
  assert.equal(payload.infCteComp, undefined);
  assert.equal(payload.infCteSub.chave, CHAVE_ORIGINAL);
  assert.equal(payload.infCteSub.indAlteraToma, 1);
});

test("Substituto (tipo 3) sem ind_alt_toma: infCteSub sem indAlteraToma", () => {
  const dto = emitirCteSchema.parse({
    ...baseCte,
    tipo_cte: "3",
    cte_referenciado_id: 7,
    servico: { valor_prestacao: 0 },
  });
  const payload = montarPayloadCte(dto, CHAVE_ORIGINAL, undefined);
  assert.equal(payload.infCteSub.indAlteraToma, undefined);
});

test("CT-e Normal (tipo 0): nenhum grupo de referência", () => {
  const dto = emitirCteSchema.parse({
    ...baseCte,
    tipo_cte: "0",
    servico: { valor_prestacao: 100 },
  });
  const payload = montarPayloadCte(dto, undefined, undefined);
  assert.equal(payload.infCteComp, undefined);
  assert.equal(payload.infCteSub, undefined);
});

test("schema rejeita ind_alt_toma em CT-e que não é Substituto", () => {
  assert.throws(() =>
    emitirCteSchema.parse({
      ...baseCte,
      tipo_cte: "1",
      cte_referenciado_id: 7,
      ind_alt_toma: true,
      servico: { valor_prestacao: 50 },
    }),
  );
});
