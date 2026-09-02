import test from "node:test";
import assert from "node:assert/strict";
import { declararCiotSchema } from "../../src/schemas/fiscalSchema.js";
import {
  resolverCategoriaOperacao,
  janelaCancelamentoHoras,
} from "../../src/services/fiscal/CiotService.js";

/**
 * CIOT — categoria da operação (item 3.2). Derivação a partir de tipo_operacao,
 * override explícito e janela de cancelamento por categoria (hoje 24h para
 * todas). Funções puras — sem banco.
 */

test("deriva categoria de tipo_operacao quando não informada", () => {
  assert.equal(resolverCategoriaOperacao({ tipo_operacao: 1 }), "lotacao");
  assert.equal(resolverCategoriaOperacao({ tipo_operacao: 2 }), "fracionada");
  assert.equal(resolverCategoriaOperacao({ tipo_operacao: 3 }), "tac_agregado");
});

test("categoria_operacao explícita tem precedência sobre tipo_operacao", () => {
  assert.equal(
    resolverCategoriaOperacao({ tipo_operacao: 3, categoria_operacao: "lotacao" }),
    "lotacao",
  );
});

test("janelaCancelamentoHoras: 24h para toda categoria e para valor desconhecido/nulo", () => {
  assert.equal(janelaCancelamentoHoras("lotacao"), 24);
  assert.equal(janelaCancelamentoHoras("fracionada"), 24);
  assert.equal(janelaCancelamentoHoras("tac_agregado"), 24);
  assert.equal(janelaCancelamentoHoras(null), 24);
  assert.equal(janelaCancelamentoHoras("qualquer"), 24);
});

test("schema aceita categoria_operacao válida e rejeita valor fora do enum", () => {
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
  assert.equal(
    declararCiotSchema.parse({ ...baseCiot, categoria_operacao: "tac_agregado" })
      .categoria_operacao,
    "tac_agregado",
  );
  assert.throws(() =>
    declararCiotSchema.parse({ ...baseCiot, categoria_operacao: "spot" }),
  );
});
