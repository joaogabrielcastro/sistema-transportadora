import test from "node:test";
import assert from "node:assert/strict";
import { declararCiotSchema } from "../../src/schemas/fiscalSchema.js";
import {
  calcularRetencoes,
  montarRetencoesPayload,
} from "../../src/services/fiscal/CiotService.js";

/**
 * CIOT — retenções do comprovante (item 3.3): INSS e SEST/SENAT. Nenhum
 * percentual hardcoded: alíquota vem do corpo ou da config. Funções puras —
 * sem banco.
 */

test("sem alíquota (nem no dto, nem na config): tudo null", () => {
  const cols = calcularRetencoes({ valor_frete: 1000 }, {});
  assert.equal(cols.retencao_base, null);
  assert.equal(cols.retencao_inss_aliquota, null);
  assert.equal(cols.retencao_inss_valor, null);
  assert.equal(cols.retencao_sest_senat_aliquota, null);
  assert.equal(cols.retencao_sest_senat_valor, null);
});

test("alíquota da config: calcula valor sobre valor_frete como base", () => {
  const cols = calcularRetencoes(
    { valor_frete: 1000 },
    { inssAliquota: 0.022, sestSenatAliquota: 0.005 },
  );
  assert.equal(cols.retencao_base, 1000);
  assert.equal(cols.retencao_inss_aliquota, 0.022);
  assert.equal(cols.retencao_inss_valor, 22);
  assert.equal(cols.retencao_sest_senat_valor, 5);
});

test("alíquota / base do corpo têm precedência sobre a config", () => {
  const cols = calcularRetencoes(
    { valor_frete: 1000, retencoes: { base: 800, inss_aliquota: 0.03 } },
    { inssAliquota: 0.022 },
  );
  assert.equal(cols.retencao_base, 800);
  assert.equal(cols.retencao_inss_aliquota, 0.03);
  assert.equal(cols.retencao_inss_valor, 24);
});

test("valor explícito no corpo não é recalculado", () => {
  const cols = calcularRetencoes(
    { valor_frete: 1000, retencoes: { inss_aliquota: 0.022, inss_valor: 99 } },
    {},
  );
  assert.equal(cols.retencao_inss_valor, 99);
});

test("montarRetencoesPayload: undefined quando não há valor de retenção", () => {
  assert.equal(
    montarRetencoesPayload(calcularRetencoes({ valor_frete: 1000 }, {})),
    undefined,
  );
});

test("montarRetencoesPayload: monta INSS / SestSenat quando há valores", () => {
  const payload = montarRetencoesPayload(
    calcularRetencoes({ valor_frete: 1000 }, { inssAliquota: 0.022 }),
  );
  assert.equal(payload.BaseCalculo, 1000);
  assert.equal(payload.INSS.Valor, 22);
  assert.equal(payload.SestSenat.Valor, undefined);
});

test("schema aceita retencoes opcional e segue válido sem ele", () => {
  const baseCiot = {
    fiscal_empresa_id: 1,
    tipo_operacao: 3,
    cpf_cnpj_contratado: "12345678000199",
    rntrc_contratado: "123456789",
    cpf_cnpj_contratante: "99999999000191",
    valor_frete: 1000,
    valor_piso_minimo_frete: 900,
    valor_vale_pedagio: 0,
    data_declaracao: "2026-09-02T10:00:00-03:00",
    data_inicio_viagem: "2026-09-03T08:00:00-03:00",
    data_fim_viagem: "2026-09-05T18:00:00-03:00",
    veiculos: [
      { placa: "ABC1D23", rntrc_veiculo: "123456789", numero_eixos: 3 },
      { placa: "ABC1D24", rntrc_veiculo: "123456789", numero_eixos: 2 },
    ],
    inf_pagamento: [{ tipo_pagamento: 1, valor: 1000 }],
  };
  assert.doesNotThrow(() => declararCiotSchema.parse(baseCiot));
  const ok = declararCiotSchema.parse({
    ...baseCiot,
    retencoes: { inss_aliquota: 0.022, sest_senat_aliquota: 0.005 },
  });
  assert.equal(ok.retencoes.inss_aliquota, 0.022);
});
