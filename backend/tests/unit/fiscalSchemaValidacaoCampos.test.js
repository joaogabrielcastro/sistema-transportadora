import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fiscalClienteSchema,
  emitirCteSchema,
  emitirMdfeSchema,
} from "../../src/schemas/fiscalSchema.js";

/**
 * Rodada de validação de campos CT-e / MDF-e: CPF/CNPJ com regra única (11 ou
 * 14), monetários com teto, percentuais 0..100, CST/UF/CIOT só número/sigla,
 * datas de documento vinculado validadas, lat/long em faixa, vale-pedágio sem
 * negativo e UFs de percurso rejeitadas (não descartadas em silêncio).
 * Tudo aqui é validação de EMISSÃO NOVA.
 */

const baseCte = () => ({
  cliente_id: 1,
  tipo_cte: "0",
  cfop: "6353",
  natureza_operacao: "Transporte",
  dt_emissao: "2026-08-22T10:00:00-03:00",
  servico: { valor_prestacao: 2500 },
  tomador: { cpf_cnpj: "12345678000199" },
});

const okCte = (over) => emitirCteSchema.parse({ ...baseCte(), ...over });
const failCte = (over) =>
  assert.throws(() => emitirCteSchema.parse({ ...baseCte(), ...over }));

const baseMdfe = () => ({
  data_emissao: "2026-09-01T12:00:00-03:00",
  uf_carregamento: "SP",
  uf_descarregamento: "MG",
  rodoviario: {},
});

const okMdfe = (over) => emitirMdfeSchema.parse({ ...baseMdfe(), ...over });
const failMdfe = (over) =>
  assert.throws(() => emitirMdfeSchema.parse({ ...baseMdfe(), ...over }));

// ------------------------------------------------------------------ CPF/CNPJ
describe("CPF/CNPJ — regra única 11 ou 14 dígitos", () => {
  it("fiscal_clientes: aceita 11 e 14, rejeita 12/13 e >14", () => {
    assert.equal(
      fiscalClienteSchema.parse({ razao_social: "Cliente X", cnpj_cpf: "123.456.789-09" })
        .cnpj_cpf,
      "12345678909",
    );
    assert.equal(
      fiscalClienteSchema.parse({
        razao_social: "Cliente X",
        cnpj_cpf: "12.345.678/0001-99",
      }).cnpj_cpf,
      "12345678000199",
    );
    assert.throws(() =>
      fiscalClienteSchema.parse({ razao_social: "Cliente X", cnpj_cpf: "123456789012" }),
    );
    assert.throws(() =>
      fiscalClienteSchema.parse({
        razao_social: "Cliente X",
        cnpj_cpf: "123456789012345678",
      }),
    );
  });

  it("CT-e tomador.cpf_cnpj: mesma regra (antes aceitava até 18)", () => {
    failCte({ tomador: { cpf_cnpj: "123456789012345678" } });
    failCte({ tomador: { cpf_cnpj: "123456789012" } });
    assert.equal(okCte({ tomador: { cpf_cnpj: "529.982.247-25" } }).tomador.cpf_cnpj, "52998224725");
  });

  it("CT-e participante e autXML: só dígitos, 11 ou 14", () => {
    failCte({ remetente: { cnpj_cpf: "123" } });
    okCte({ remetente: { cnpj_cpf: "12.345.678/0001-99" } });
    failCte({ aut_xml: ["123"] });
    okCte({ aut_xml: ["12345678000199"] });
  });
});

// ------------------------------------------------------------------ texto
describe("Texto com limite", () => {
  it("cfop: exatamente 4 dígitos", () => {
    failCte({ cfop: "635" });
    failCte({ cfop: "63530" });
    failCte({ cfop: "5A53" });
    assert.equal(okCte({ cfop: "5353" }).cfop, "5353");
  });

  it("natureza_operacao: no máximo 60", () => {
    failCte({ natureza_operacao: "x".repeat(61) });
    okCte({ natureza_operacao: "x".repeat(60) });
  });

  it("modal.rntrc: exatamente 8 dígitos (9 agora é rejeitado)", () => {
    failCte({ modal: { rntrc: "123" } });
    failCte({ modal: { rntrc: "123456789" } });
    assert.equal(okCte({ modal: { rntrc: "12345678" } }).modal.rntrc, "12345678");
  });

  it("MDF-e condutor_nome manual: no máximo 60", () => {
    failMdfe({
      rodoviario: { condutores: [{ nome: "x".repeat(61), cpf: "52998224725" }] },
    });
  });
});

// ------------------------------------------------------------------ monetários
describe("Monetários com teto (DECIMAL(14,2) → 12 dígitos inteiros)", () => {
  it("CT-e valor_prestacao / componentes / infCarga / trib_fed / difal", () => {
    failCte({ servico: { valor_prestacao: 1e13 } });
    failCte({ servico: { valor_prestacao: 100, componentes: [{ nome: "X", valor: 1e13 }] } });
    failCte({ carga: { valor_carga: 1e13 } });
    failCte({ trib_fed: { pis_valor: 1e13 } });
    failCte({ difal: { v_icms_uf_fim: 1e13 } });
    okCte({ servico: { valor_prestacao: 999999999999.99 } });
  });

  it("MDF-e valor e vale-pedágio: sem teto estourado e sem negativo", () => {
    failMdfe({ valor: 1e13 });
    failMdfe({ inf_antt: { vale_pedagio: { valor: -1 } } });
    assert.equal(
      okMdfe({ inf_antt: { vale_pedagio: { valor: 180.5 } } }).inf_antt.vale_pedagio.valor,
      180.5,
    );
  });

  it("MDF-e peso: teto de DECIMAL(14,3)", () => {
    failMdfe({ peso: 1e12 });
    okMdfe({ peso: 15000 });
  });

  it("CT-e infQ quantidade: teto de DECIMAL(15,4)", () => {
    failCte({ carga: { quantidades: [{ quantidade: 1e12 }] } });
    assert.equal(
      okCte({ carga: { quantidades: [{ quantidade: 25000.555 }] } }).carga
        .quantidades[0].quantidade,
      25000.555,
    );
  });
});

// ------------------------------------------------------------------ percentuais
describe("Percentuais travados 0..100", () => {
  it("ICMS alíquota / redução e DIFAL", () => {
    failCte({ icms: { aliquota: 150 } });
    failCte({ icms: { reducao_base: -1 } });
    failCte({ difal: { p_icms_uf_fim: 101 } });
    okCte({ icms: { aliquota: 12, reducao_base: 33.33 }, difal: { p_icms_uf_fim: 18 } });
  });

  it("IBS/CBS alíquotas e reduções", () => {
    failCte({ ibscbs: { cbs_aliquota: 250 } });
    okCte({ ibscbs: { c_class_trib: "000001", base: 1000, cbs_aliquota: 8.8 } });
  });
});

// ------------------------------------------------------------------ só número/sigla
describe("Campos que só aceitam número ou sigla", () => {
  it("CST do ICMS/IBSCBS: 2 ou 3 dígitos, sem letra", () => {
    failCte({ icms: { cst: "A0" } });
    failCte({ icms: { cst: "0" } });
    okCte({ icms: { cst: "00" } });
    okCte({ icms: { cst: "020" } });
  });

  it("UF (CT-e uf_ini/uf_fim, MDF-e carregamento/ide): 2 letras, upper automático", () => {
    failCte({ uf_ini: "S1" });
    assert.equal(okCte({ uf_ini: "sp", uf_fim: "mg" }).uf_ini, "SP");
    failMdfe({ uf_carregamento: "S" });
    assert.equal(okMdfe({ uf_carregamento: "sp" }).uf_carregamento, "SP");
    failMdfe({ ide: { uf_fim: "M1" } });
  });

  it("CIOT do MDF-e: só dígitos, no máximo 12 (era 20)", () => {
    failMdfe({ inf_antt: { ciot: "1234567890123" } }); // 13 dígitos
    // Pontuação é normalizada para só dígitos (mesmo padrão de RNTRC/CNPJ).
    assert.equal(okMdfe({ inf_antt: { ciot: "123-456" } }).inf_antt.ciot, "123456");
    assert.equal(okMdfe({ inf_antt: { ciot: "999999999999" } }).inf_antt.ciot, "999999999999");
  });
});

// ------------------------------------------------------------------ seguros MDF-e
describe("Seguro do MDF-e — schema tipado (era looseObject)", () => {
  it("com NOSSOS nomes: responsavel 1/2, CNPJ 14, averbação <= 20", () => {
    failMdfe({ seguros: [{ responsavel: 3 }] });
    failMdfe({ seguros: [{ responsavel: 1, cnpj_seguradora: "123" }] });
    failMdfe({ seguros: [{ responsavel: 1, numeros_averbacao: ["x".repeat(21)] }] });
    const ok = okMdfe({
      seguros: [
        {
          responsavel: 2,
          cnpj_seguradora: "12.345.678/0001-99",
          numeros_averbacao: ["AV-1", "AV-2"],
        },
      ],
    });
    assert.equal(ok.seguros[0].cnpj_seguradora, "12345678000199");
  });

  it("passthrough no formato do provedor continua aceito", () => {
    const ok = okMdfe({
      seguros: [{ indicadorResponsavel: 1, cnpjSegurador: "111", numerosAverbacao: ["A1"] }],
    });
    assert.equal(ok.seguros[0].indicadorResponsavel, 1);
  });
});

// ------------------------------------------------------------------ pontuais
describe("Pontuais", () => {
  it("e-mail do participante exige formato de e-mail", () => {
    failCte({ remetente: { email: "sem-arroba" } });
    okCte({ remetente: { email: "contato@empresa.com.br" } });
  });

  it("e-mail do Tomador do serviço também exige formato de e-mail", () => {
    failCte({ tomador: { cpf_cnpj: "12345678000199", email: "sem-arroba" } });
    okCte({
      tomador: { cpf_cnpj: "12345678000199", email: "financeiro@tomador.com.br" },
    });
  });

  it("data de emissão do documento vinculado (infDoc) é validada", () => {
    failCte({ documentos: [{ tipo: "nf", numero: "123", data_emissao: "não é data" }] });
    okCte({ documentos: [{ tipo: "nf", numero: "123", data_emissao: "2026-08-20" }] });
  });

  it("lat/long da lotação do MDF-e em faixa (-90..90 / -180..180)", () => {
    failMdfe({ prod_pred: { inf_lotacao: { carrega: { latitude: 91 } } } });
    failMdfe({ prod_pred: { inf_lotacao: { descarrega: { longitude: -181 } } } });
    okMdfe({
      prod_pred: { inf_lotacao: { carrega: { latitude: -23.55, longitude: -46.63 } } },
    });
  });

  it("percurso_ufs: item inválido é rejeitado, não descartado", () => {
    failMdfe({ percurso_ufs: ["SP", "XYZ"] });
    failMdfe({ percurso_ufs: ["SP", "R1"] });
    assert.deepEqual(okMdfe({ percurso_ufs: ["sp", "rj", "mg"] }).percurso_ufs, [
      "SP",
      "RJ",
      "MG",
    ]);
  });
});
