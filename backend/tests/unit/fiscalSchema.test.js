import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fiscalClienteSchema,
  fiscalEmpresaSchema,
  cancelarDocumentoSchema,
  emitirCteSchema,
  emitirMdfeSchema,
  declararCiotSchema,
} from "../../src/schemas/fiscalSchema.js";

describe("fiscalSchema", () => {
  it("fiscal_clientes.cnpj_cpf é normalizado (só dígitos)", () => {
    const out = fiscalClienteSchema.parse({
      razao_social: "Comércio de Peças Ltda",
      cnpj_cpf: "12.345.678/0001-99",
    });
    assert.equal(out.cnpj_cpf, "12345678000199");
  });

  it("fiscal_empresas.cnpj normalizado", () => {
    const out = fiscalEmpresaSchema.parse({
      cnpj: "12.345.678/0001-99",
      razao_social: "Transportadora X",
    });
    assert.equal(out.cnpj, "12345678000199");
  });

  it("cancelar: justificativa < 15 é rejeitada", () => {
    assert.throws(() => cancelarDocumentoSchema.parse({ justificativa: "curto" }));
    const ok = cancelarDocumentoSchema.parse({
      justificativa: "Erro de digitação no valor do frete informado",
    });
    assert.ok(ok.justificativa.length >= 15);
  });

  it("emitir CT-e exige tomador.cpf_cnpj e cliente_id", () => {
    assert.throws(() =>
      emitirCteSchema.parse({
        tipo_cte: "0",
        cfop: "6353",
        natureza_operacao: "Transporte",
        dt_emissao: "2026-08-22T10:00:00-03:00",
        servico: { valor_prestacao: 100 },
        tomador: {},
      }),
    );
    const ok = emitirCteSchema.parse({
      cliente_id: 1,
      tipo_cte: "0",
      cfop: "6353",
      natureza_operacao: "Transporte",
      dt_emissao: "2026-08-22T10:00:00-03:00",
      servico: { valor_prestacao: 2500 },
      tomador: { cpf_cnpj: "12.345.678/0001-99", nome: "Tomador" },
    });
    assert.equal(ok.tomador.cpf_cnpj, "12345678000199");
    assert.equal(ok.servico.valor_prestacao, 2500);
  });

  it('CT-e: tipo "2" (Anulação) foi extinto e é rejeitado', () => {
    assert.throws(() =>
      emitirCteSchema.parse({
        cliente_id: 1,
        tipo_cte: "2",
        cfop: "6353",
        natureza_operacao: "Transporte",
        dt_emissao: "2026-08-22T10:00:00-03:00",
        servico: { valor_prestacao: 100 },
        tomador: { cpf_cnpj: "12345678000199" },
      }),
    );
  });

  it("CT-e: Complemento (1) e Substituto (3) exigem cte_referenciado_id", () => {
    const base = {
      cliente_id: 1,
      cfop: "6353",
      natureza_operacao: "Transporte",
      dt_emissao: "2026-08-22T10:00:00-03:00",
      servico: { valor_prestacao: 100 },
      tomador: { cpf_cnpj: "12345678000199" },
    };
    assert.throws(() => emitirCteSchema.parse({ ...base, tipo_cte: "1" }));
    assert.throws(() => emitirCteSchema.parse({ ...base, tipo_cte: "3" }));
    const ok = emitirCteSchema.parse({
      ...base,
      tipo_cte: "3",
      cte_referenciado_id: 42,
    });
    assert.equal(ok.cte_referenciado_id, 42);
  });

  it("CT-e: Complemento (1) exige valor_prestacao positivo", () => {
    assert.throws(() =>
      emitirCteSchema.parse({
        cliente_id: 1,
        tipo_cte: "1",
        cte_referenciado_id: 42,
        cfop: "6353",
        natureza_operacao: "Transporte",
        dt_emissao: "2026-08-22T10:00:00-03:00",
        servico: { valor_prestacao: 0 },
        tomador: { cpf_cnpj: "12345678000199" },
      }),
    );
  });

  it("CT-e: peso da carga e chave_nfe_referenciada (44 dígitos, DV válido)", () => {
    const ok = emitirCteSchema.parse({
      cliente_id: 1,
      tipo_cte: "0",
      cfop: "6353",
      natureza_operacao: "Transporte",
      dt_emissao: "2026-08-22T10:00:00-03:00",
      servico: { valor_prestacao: 2500 },
      tomador: { cpf_cnpj: "12345678000199" },
      carga: { peso: 15000, produto_predominante: "Soja" },
      chave_nfe_referenciada: "3524 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000",
    });
    assert.equal(ok.carga.peso, 15000);
    assert.equal(ok.chave_nfe_referenciada.length, 44);
    // DV inválido é rejeitado
    assert.throws(() =>
      emitirCteSchema.parse({
        cliente_id: 1,
        tipo_cte: "0",
        cfop: "6353",
        natureza_operacao: "Transporte",
        dt_emissao: "2026-08-22T10:00:00-03:00",
        servico: { valor_prestacao: 1 },
        tomador: { cpf_cnpj: "12345678000199" },
        chave_nfe_referenciada: "3".repeat(44),
      }),
    );
  });

  it("MDF-e: aceita cte_ids e campos de seguro (resp_seg + apólice)", () => {
    const ok = emitirMdfeSchema.parse({
      data_emissao: "2026-08-31T12:00:00-03:00",
      uf_carregamento: "SP",
      uf_descarregamento: "MG",
      rodoviario: {},
      cte_ids: [10, 11],
      resp_seg: 1,
      cnpj_seguradora: "12.345.678/0001-99",
      numero_apolice: "AP-2026-001",
      numero_averbacao: "AV-9",
    });
    assert.deepEqual(ok.cte_ids, [10, 11]);
    assert.equal(ok.resp_seg, 1);
    assert.equal(ok.cnpj_seguradora, "12345678000199");
  });

  it("CIOT Lotação (1) exige destinatário, origem_destino e dados_carga", () => {
    const base = {
      fiscal_empresa_id: 1,
      tipo_operacao: 1,
      cpf_cnpj_contratado: "12345678000199",
      rntrc_contratado: "123456789",
      cpf_cnpj_contratante: "98765432000199",
      valor_frete: 2500.5,
      valor_piso_minimo_frete: 2100,
      valor_vale_pedagio: 180.5,
      data_declaracao: "2026-08-27T10:00:00-03:00",
      data_inicio_viagem: "2026-08-27",
      data_fim_viagem: "2026-08-29",
      veiculos: [
        { placa: "ABC1D23", rntrc_veiculo: "123456789", numero_eixos: 5 },
        { placa: "ABC1D24", rntrc_veiculo: "123456789", numero_eixos: 3 },
      ],
      inf_pagamento: [{ tipo_pagamento: 1, valor: 2500.5 }],
    };
    assert.throws(() => declararCiotSchema.parse(base));

    const ok = declararCiotSchema.parse({
      ...base,
      cpf_cnpj_destinatario: "11222333000144",
      origem_destino: {
        codigo_municipio_origem: "3550308",
        codigo_municipio_destino: "3304557",
      },
      dados_carga: {
        codigo_natureza_carga: "01",
        peso_carga: 15000,
        codigo_tipo_carga: 1,
      },
      inf_indicadores_operacionais: { possui_rastreamento: false },
    });
    assert.equal(ok.tipo_operacao, 1);
    assert.equal(ok.cpf_cnpj_contratado, "12345678000199");
    assert.equal(ok.valor_piso_minimo_frete, 2100);
    assert.equal(ok.valor_vale_pedagio, 180.5);
  });

  it("CIOT exige piso mínimo de frete e Vale-Pedágio (obrigatórios por lei)", () => {
    const base = {
      fiscal_empresa_id: 1,
      tipo_operacao: 3,
      cpf_cnpj_contratado: "12345678000199",
      rntrc_contratado: "123456789",
      cpf_cnpj_contratante: "98765432000199",
      valor_frete: 1000,
      data_declaracao: "2026-08-27T10:00:00-03:00",
      data_inicio_viagem: "2026-08-27",
      data_fim_viagem: "2026-08-29",
      veiculos: [
        { placa: "ABC1D23", rntrc_veiculo: "123456789", numero_eixos: 5 },
        { placa: "ABC1D24", rntrc_veiculo: "123456789", numero_eixos: 3 },
      ],
      inf_pagamento: [{ tipo_pagamento: 1, valor: 1000 }],
    };
    assert.throws(() => declararCiotSchema.parse(base));
    const ok = declararCiotSchema.parse({
      ...base,
      valor_piso_minimo_frete: 950,
      valor_vale_pedagio: 0,
    });
    assert.equal(ok.valor_vale_pedagio, 0);
  });

  it("CIOT TAC-Agregado (3) rejeita destinatário", () => {
    assert.throws(() =>
      declararCiotSchema.parse({
        fiscal_empresa_id: 1,
        tipo_operacao: 3,
        cpf_cnpj_contratado: "12345678000199",
        rntrc_contratado: "123456789",
        cpf_cnpj_contratante: "98765432000199",
        cpf_cnpj_destinatario: "11222333000144",
        valor_frete: 1000,
        valor_piso_minimo_frete: 950,
        valor_vale_pedagio: 0,
        data_declaracao: "2026-08-27T10:00:00-03:00",
        data_inicio_viagem: "2026-08-27",
        data_fim_viagem: "2026-08-29",
        veiculos: [
          { placa: "ABC1D23", rntrc_veiculo: "123456789", numero_eixos: 5 },
          { placa: "ABC1D24", rntrc_veiculo: "123456789", numero_eixos: 3 },
        ],
        inf_pagamento: [{ tipo_pagamento: 1, valor: 1000 }],
      }),
    );
  });

  it("CIOT exige de 2 a 5 veículos", () => {
    const base = {
      fiscal_empresa_id: 1,
      tipo_operacao: 3,
      cpf_cnpj_contratado: "12345678000199",
      rntrc_contratado: "123456789",
      cpf_cnpj_contratante: "98765432000199",
      valor_frete: 1000,
      valor_piso_minimo_frete: 950,
      valor_vale_pedagio: 0,
      data_declaracao: "2026-08-27T10:00:00-03:00",
      data_inicio_viagem: "2026-08-27",
      data_fim_viagem: "2026-08-29",
      inf_pagamento: [{ tipo_pagamento: 1, valor: 1000 }],
      veiculos: [{ placa: "ABC1D23", rntrc_veiculo: "123456789", numero_eixos: 5 }],
    };
    assert.throws(() => declararCiotSchema.parse(base));
  });
});
