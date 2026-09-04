import test from "node:test";
import assert from "node:assert/strict";
import {
  montarCarga,
  montarPayloadCte,
} from "../../src/services/fiscal/CteService.js";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";

/**
 * Cobre a montagem do payload de CT-e: peso no grupo Carga, NF-e transportada
 * em Carga.Documentos[].Chave e a chave do CT-e referenciado
 * (Complemento/Substituto). Funções puras — sem banco.
 */

const CHAVE_44 = "3".repeat(44);

test("peso da carga entra em Carga.peso", () => {
  const carga = montarCarga({ carga: { peso: 15000, valor_carga: 200 } });
  assert.equal(carga.peso, 15000);
  assert.equal(carga.valor_carga, 200);
});

test("chave_nfe_referenciada vira Carga.documentos[].chave", () => {
  const carga = montarCarga({
    carga: { peso: 1 },
    chave_nfe_referenciada: CHAVE_44,
  });
  assert.deepEqual(carga.documentos, [{ chave: CHAVE_44 }]);
});

test("sem carga e sem chave -> Carga undefined", () => {
  assert.equal(montarCarga({}), undefined);
});

test("chave sem carga -> cria Carga só com documentos", () => {
  const carga = montarCarga({ chave_nfe_referenciada: CHAVE_44 });
  assert.deepEqual(carga, { documentos: [{ chave: CHAVE_44 }] });
});

test("montarPayloadCte inclui TipoCte e ChaveCteReferenciado", () => {
  const dto = emitirCteSchema.parse({
    cliente_id: 1,
    tipo_cte: "3",
    cte_referenciado_id: 9,
    cfop: "6353",
    natureza_operacao: "Substituição",
    dt_emissao: "2026-08-22T10:00:00-03:00",
    servico: { valor_prestacao: 2500 },
    tomador: { cpf_cnpj: "12345678000199" },
  });
  const payload = montarPayloadCte(dto, "5".repeat(44));
  assert.equal(payload.TipoCte, 3);
  assert.equal(payload.ChaveCteReferenciado, "5".repeat(44));
  assert.equal(payload.ModeloDocumento, 57);
  assert.equal(payload.Cfop, 6353);
});

test("CT-e Normal não leva ChaveCteReferenciado", () => {
  const dto = emitirCteSchema.parse({
    cliente_id: 1,
    tipo_cte: "0",
    cfop: "6353",
    natureza_operacao: "Transporte",
    dt_emissao: "2026-08-22T10:00:00-03:00",
    servico: { valor_prestacao: 100 },
    tomador: { cpf_cnpj: "12345678000199" },
  });
  const payload = montarPayloadCte(dto, undefined);
  assert.equal(payload.ChaveCteReferenciado, undefined);
  assert.equal(payload.TipoCte, 0);
});

test("Observacao e Retira entram no payload oficial quando presentes no DTO", () => {
  const dto = emitirCteSchema.parse({
    cliente_id: 1,
    tipo_cte: "0",
    cfop: "5352",
    natureza_operacao: "Transporte",
    dt_emissao: "2026-08-22T10:00:00-03:00",
    observacao: "Entrega em horário comercial.",
    retira: false,
    servico: { valor_prestacao: 100 },
    tomador: { cpf_cnpj: "12345678000199" },
  });
  const payload = montarPayloadCte(dto, undefined);
  assert.equal(payload.Observacao, "Entrega em horário comercial.");
  assert.equal(payload.Retira, false);
});
