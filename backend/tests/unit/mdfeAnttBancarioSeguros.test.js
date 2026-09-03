import test from "node:test";
import assert from "node:assert/strict";
import {
  montarPayloadMdfe,
  montarPagamentosMdfe,
  montarInfLotacaoMdfe,
  normalizarSegurosMdfe,
} from "../../src/services/fiscal/MdfeService.js";
import { emitirMdfeSchema } from "../../src/schemas/fiscalSchema.js";

/**
 * FASE 0 — divergências confirmadas com o payload real do provedor:
 *  0.1 infANTT bancário/PIX -> pagamentos[].infoBancaria
 *  0.2 seguro do MDF-e é LISTA, com numerosAverbacao em array
 *  0.3 prodPred mais rico: c_ean + infLotacao (CEP + lat/long)
 *  0.4 totalizadores valor/peso vão de fato no payload enviado
 * Funções puras — sem banco.
 */

const parse = (over = {}) =>
  emitirMdfeSchema.parse({
    data_emissao: "2026-09-01T12:00:00-03:00",
    uf_carregamento: "SP",
    uf_descarregamento: "MG",
    rodoviario: {},
    ...over,
  });

// ------------------------------------------------------------------ 0.1
test("0.1 infoBancaria: sem campos bancários -> payload NÃO ganha pagamentos", () => {
  const dto = parse({ inf_antt: { rntrc: "123456789" } });
  assert.equal(montarPagamentosMdfe(dto), undefined);
  const payload = montarPayloadMdfe(dto, "ABC1D23", [], [], []);
  assert.ok(!("pagamentos" in payload));
});

test("0.1 infoBancaria: com PIX/banco -> pagamentos[0].infoBancaria preenchido", () => {
  const dto = parse({
    inf_antt: {
      rntrc: "123456789",
      cod_banco: "001",
      cod_agencia: "1234",
      cnpj_instituicao_pagamento: "12.345.678/0001-99",
      pix: "chave-pix@ex.com",
    },
  });
  const pg = montarPagamentosMdfe(dto);
  assert.equal(pg.length, 1);
  assert.deepEqual(pg[0].infoBancaria, {
    codBanco: "001",
    codAgencia: "1234",
    cnpjInstituicaoPagamento: "12345678000199",
    pix: "chave-pix@ex.com",
  });
  const payload = montarPayloadMdfe(dto, "ABC1D23", [], [], []);
  assert.equal(payload.pagamentos[0].infoBancaria.pix, "chave-pix@ex.com");
  // infANTT segue existindo com o RNTRC — os dados bancários NÃO vão nele
  assert.equal(payload.infANTT.RNTRC, "123456789");
  assert.equal(payload.infANTT.codBanco, undefined);
});

test("0.1 infoBancaria: só um campo (pix) já basta", () => {
  const dto = parse({ inf_antt: { pix: "só-pix" } });
  const pg = montarPagamentosMdfe(dto);
  assert.equal(pg[0].infoBancaria.pix, "só-pix");
  assert.equal(pg[0].infoBancaria.codBanco, undefined);
});

// ------------------------------------------------------------------ 0.2
test("0.2 seguros: múltiplos seguros com múltiplas averbações vão como array no payload", () => {
  const dto = parse({
    seguros: [
      { indicadorResponsavel: 1, cnpjSegurador: "111", numerosAverbacao: ["A1", "A2"] },
      { indicadorResponsavel: 2, cnpjSegurador: "222", numerosAverbacao: ["B1"] },
    ],
  });
  const payload = montarPayloadMdfe(dto, "ABC1D23", [], [], []);
  assert.equal(payload.seguros.length, 2);
  assert.deepEqual(payload.seguros[0].numerosAverbacao, ["A1", "A2"]);
  assert.deepEqual(payload.seguros[1].numerosAverbacao, ["B1"]);
});

test("0.2 normalizarSegurosMdfe: linhas p/ fiscal_mdfe_seguros (provider e snake_case)", () => {
  const linhas = normalizarSegurosMdfe({
    seguros: [
      { indicadorResponsavel: 1, cnpjSegurador: "12345678000199", numeroApolice: "AP1", numerosAverbacao: ["X", "Y"] },
      { responsavel: 2, cnpj_seguradora: "999", numero_apolice: "AP2", numero_averbacao: "Z" },
    ],
  });
  assert.equal(linhas.length, 2);
  assert.deepEqual(linhas[0], {
    responsavel: 1,
    cnpj_seguradora: "12345678000199",
    numero_apolice: "AP1",
    nome_seguradora: null,
    numeros_averbacao: ["X", "Y"],
  });
  assert.deepEqual(linhas[1].numeros_averbacao, ["Z"]);
});

test("0.2 normalizarSegurosMdfe: sem dto.seguros -> [] (colunas singulares seg_* seguem como fallback)", () => {
  assert.deepEqual(normalizarSegurosMdfe({}), []);
  assert.deepEqual(normalizarSegurosMdfe({ seguros: [] }), []);
});

// ------------------------------------------------------------------ 0.3
test("0.3 prodPred: c_ean e infLotacao (CEP + lat/long) entram no payload", () => {
  const dto = parse({
    prod_pred: {
      descricao: "Soja",
      ncm: "12019000",
      tp_carga: "01",
      c_ean: "SEM GTIN",
      inf_lotacao: {
        carrega: { cep: "01001-000", latitude: -23.55, longitude: -46.63 },
        descarrega: { cep: "30110-000", latitude: -19.92, longitude: -43.94 },
      },
    },
  });
  const payload = montarPayloadMdfe(dto, "ABC1D23", [], [], []);
  assert.equal(payload.produtoPredominante.xProd, "Soja");
  assert.equal(payload.produtoPredominante.tpCarga, "01");
  assert.equal(payload.produtoPredominante.cEan, "SEM GTIN");
  assert.deepEqual(payload.produtoPredominante.infLotacao, {
    localCarrega: { cep: "01001000", latitude: -23.55, longitude: -46.63 },
    localDescarrega: { cep: "30110000", latitude: -19.92, longitude: -43.94 },
  });
});

test("0.3 montarInfLotacaoMdfe: ausente/vazio -> undefined; só carrega -> só localCarrega", () => {
  assert.equal(montarInfLotacaoMdfe(undefined), undefined);
  assert.equal(montarInfLotacaoMdfe({}), undefined);
  assert.equal(montarInfLotacaoMdfe({ carrega: {}, descarrega: {} }), undefined);
  assert.deepEqual(montarInfLotacaoMdfe({ carrega: { cep: "12345678" } }), {
    localCarrega: { cep: "12345678" },
  });
});

test("0.3 prodPred sem os campos novos: payload inalterado (só xProd/NCM/tpCarga)", () => {
  const dto = parse({ prod_pred: { descricao: "Milho", ncm: "10059000" } });
  const payload = montarPayloadMdfe(dto, "ABC1D23", [], [], []);
  assert.equal(payload.produtoPredominante.xProd, "Milho");
  assert.equal(payload.produtoPredominante.cEan, undefined);
  assert.equal(payload.produtoPredominante.infLotacao, undefined);
});

// ------------------------------------------------------------------ 0.4
test("0.4 totalizadores: valor/peso do DTO vão no payload enviado ao provedor", () => {
  const dto = parse({ valor: 15000.5, peso: 24000 });
  const payload = montarPayloadMdfe(dto, "ABC1D23", [], [], []);
  assert.equal(payload.valor, 15000.5);
  assert.equal(payload.peso, 24000);
});

test("0.4 totalizadores: com tot calculado dos CT-e, vCarga/qCarga têm precedência e vão no payload", () => {
  const dto = parse({ valor: 1, peso: 1 });
  const payload = montarPayloadMdfe(dto, "ABC1D23", [], [], [], {
    qCTe: 3,
    vCarga: 9999.99,
    qCarga: 5000,
  });
  assert.equal(payload.valor, 9999.99);
  assert.equal(payload.peso, 5000);
  assert.equal(payload.tot.qCTe, 3);
});
