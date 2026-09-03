import test from "node:test";
import assert from "node:assert/strict";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";
import {
  colunasContingenciaTribFed,
  montarImpCte,
  montarPayloadCte,
  normalizarParticipantesCte,
} from "../../src/services/fiscal/CteService.js";

/**
 * FASE 0 — divergências do CT-e confirmadas com o payload real do provedor:
 *  0.7 Tomador é entidade PRÓPRIA e COMPLETA (endereço + contato), sempre
 *      enviada por inteiro, e gravada como participante independente (papel 'toma').
 *  0.8 TributosFederal aceita, além de PIS/COFINS, os totalizadores IR/INSS/CSLL.
 * Funções puras — sem banco.
 */

const baseCte = {
  cliente_id: 1,
  tipo_cte: "0",
  cfop: "6353",
  natureza_operacao: "Transporte",
  dt_emissao: "2026-02-01T10:00:00-03:00",
  servico: { valor_prestacao: 100 },
  tomador: { cpf_cnpj: "12345678000199" },
};

// ------------------------------------------------------------------ 0.7
test("0.7 schema: tomador aceita endereço + contato completos e ainda { cpf_cnpj } sozinho", () => {
  const minimo = emitirCteSchema.parse(baseCte);
  assert.equal(minimo.tomador.cpf_cnpj, "12345678000199");

  const completo = emitirCteSchema.parse({
    ...baseCte,
    tomador: {
      cpf_cnpj: "12.345.678/0001-99",
      razao_social: "Tomador LTDA",
      email: "fin@tomador.com",
      endereco: { uf: "SP", codigo_municipio: "3550308", cep: "01001-000" },
      campoLivreDoProvedor: "mantido",
    },
  });
  assert.equal(completo.tomador.razao_social, "Tomador LTDA");
  assert.equal(completo.tomador.endereco.cep, "01001000");
  assert.equal(completo.tomador.campoLivreDoProvedor, "mantido");
});

test("0.7 normalizarParticipantesCte grava o tomador como papel 'toma' (doc no campo cpf_cnpj)", () => {
  const dto = {
    remetente: { razao_social: "Origem", cnpj_cpf: "11222333000144" },
    tomador: {
      cpf_cnpj: "12345678000199",
      razao_social: "Tomador LTDA",
      endereco: { uf: "SP", nome_municipio: "São Paulo" },
    },
  };
  const linhas = normalizarParticipantesCte(dto);
  const toma = linhas.find((l) => l.papel === "toma");
  assert.ok(toma, "esperava uma linha de participante com papel 'toma'");
  assert.equal(toma.cnpj_cpf, "12345678000199");
  assert.equal(toma.razao_social, "Tomador LTDA");
  assert.equal(toma.uf, "SP");
});

test("0.7 sem tomador no objeto cru: nenhuma linha 'toma' (compatível pra trás)", () => {
  const linhas = normalizarParticipantesCte({ remetente: { razao_social: "X" } });
  assert.equal(linhas.length, 1);
  assert.ok(!linhas.some((l) => l.papel === "toma"));
});

test("0.7 montarPayloadCte envia o objeto Tomador por inteiro", () => {
  const dto = emitirCteSchema.parse({
    ...baseCte,
    tomador: { cpf_cnpj: "12345678000199", razao_social: "Tomador LTDA" },
  });
  const payload = montarPayloadCte(dto, undefined, undefined);
  assert.equal(payload.Tomador.razao_social, "Tomador LTDA");
  assert.equal(payload.Tomador.cpf_cnpj, "12345678000199");
});

// ------------------------------------------------------------------ 0.8
test("0.8 trib_fed: IR/INSS/CSLL entram em imp.TributosFederal junto de PIS/COFINS", () => {
  const ok = emitirCteSchema.parse({
    ...baseCte,
    trib_fed: { pis_valor: 1.65, cofins_valor: 7.6, ir_valor: 15, inss_valor: 11, csll_valor: 9 },
  });
  const imp = montarImpCte(ok);
  assert.deepEqual(imp.TributosFederal, {
    ValorPis: 1.65,
    ValorCofins: 7.6,
    ValorIr: 15,
    ValorInss: 11,
    ValorCsll: 9,
  });
  const cols = colunasContingenciaTribFed(ok);
  assert.equal(cols.ir_valor, 15);
  assert.equal(cols.inss_valor, 11);
  assert.equal(cols.csll_valor, 9);
});

test("0.8 só PIS/COFINS: TributosFederal NÃO ganha as chaves de IR/INSS/CSLL (payload inalterado)", () => {
  const ok = emitirCteSchema.parse({
    ...baseCte,
    trib_fed: { pis_valor: 1.65, cofins_valor: 7.6 },
  });
  const imp = montarImpCte(ok);
  assert.deepEqual(Object.keys(imp.TributosFederal).sort(), ["ValorCofins", "ValorPis"]);
});

test("0.8 só INSS: apenas ValorInss aparece", () => {
  const ok = emitirCteSchema.parse({ ...baseCte, trib_fed: { inss_valor: 22 } });
  const imp = montarImpCte(ok);
  assert.deepEqual(imp.TributosFederal, { ValorInss: 22 });
});
