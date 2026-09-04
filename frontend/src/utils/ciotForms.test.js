import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  exigeDestinatarioCargaCiot,
  exigeIndicadoresCiot,
  montarPayloadCiot,
  errosDeclaracaoCiot,
} from "./ciotForms.js";

const formBase = {
  fiscal_empresa_id: "1",
  tipo_operacao: "3",
  cpf_cnpj_contratado: "12.345.678/0001-99",
  rntrc_contratado: "123456789",
  cpf_cnpj_contratante: "98.765.432/0001-99",
  valor_frete: "2500.50",
  valor_piso_minimo_frete: "2100",
  valor_vale_pedagio: "0",
  data_declaracao: "2026-08-27T10:00",
  data_inicio_viagem: "2026-08-27",
  data_fim_viagem: "2026-08-29",
};

const doisVeiculos = [
  { placa: "ABC1D23", rntrc_veiculo: "123456789", numero_eixos: "5" },
  { placa: "ABC1D24", rntrc_veiculo: "123456789", numero_eixos: "3" },
];

const umPagamento = [{ tipo_pagamento: "1", valor: "2500.50" }];

describe("regras condicionais do CIOT", () => {
  it("lotação e fracionada exigem destinatário/carga; TAC não", () => {
    assert.equal(exigeDestinatarioCargaCiot(1), true);
    assert.equal(exigeDestinatarioCargaCiot("2"), true);
    assert.equal(exigeDestinatarioCargaCiot(3), false);
    assert.equal(exigeIndicadoresCiot(1), true);
    assert.equal(exigeIndicadoresCiot(2), false);
  });
});

describe("montarPayloadCiot", () => {
  it("TAC-Agregado não inclui destinatário nem carga", () => {
    const payload = montarPayloadCiot({
      form: {
        ...formBase,
        cpf_cnpj_destinatario: "11222333000144",
      },
      veiculos: doisVeiculos,
      pagamentos: umPagamento,
    });
    assert.equal(payload.tipo_operacao, 3);
    assert.equal(payload.cpf_cnpj_contratado, "12345678000199");
    assert.equal(payload.valor_vale_pedagio, 0);
    assert.equal(payload.cpf_cnpj_destinatario, undefined);
    assert.equal(payload.dados_carga, undefined);
    assert.equal(payload.veiculos.length, 2);
    assert.equal(errosDeclaracaoCiot(payload).length, 0);
  });

  it("lotação inclui destinatário, IBGE, carga e indicadores", () => {
    const payload = montarPayloadCiot({
      form: {
        ...formBase,
        tipo_operacao: "1",
        cpf_cnpj_destinatario: "11.222.333/0001-44",
        codigo_municipio_origem: "3550308",
        codigo_municipio_destino: "3304557",
        codigo_natureza_carga: "01",
        peso_carga: "15000",
        codigo_tipo_carga: "1",
        carga_ncm: "87032100",
        possui_rastreamento: true,
        possui_seguro_carga: false,
        caminhao_id: "9",
      },
      veiculos: doisVeiculos,
      pagamentos: umPagamento,
    });
    assert.equal(payload.cpf_cnpj_destinatario, "11222333000144");
    assert.equal(payload.origem_destino.codigo_municipio_origem, "3550308");
    assert.equal(payload.dados_carga.ncm, "87032100");
    assert.equal(payload.inf_indicadores_operacionais.possui_rastreamento, true);
    assert.equal(payload.caminhao_id, 9);
    assert.equal(errosDeclaracaoCiot(payload).length, 0);
  });

  it("bloqueia frete abaixo do piso e menos de 2 veículos", () => {
    const payload = montarPayloadCiot({
      form: { ...formBase, valor_frete: "100", valor_piso_minimo_frete: "200" },
      veiculos: [doisVeiculos[0]],
      pagamentos: umPagamento,
    });
    const erros = errosDeclaracaoCiot(payload);
    assert.ok(erros.some((e) => /abaixo do piso/i.test(e)));
    assert.ok(erros.some((e) => /2 veículos/i.test(e)));
  });
});
