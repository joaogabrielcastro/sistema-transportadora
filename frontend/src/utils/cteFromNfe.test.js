import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeDocumentosCte,
  resumoCargaDasNfes,
  matchClientePorCnpj,
  aplicarNfesCte,
} from "./cteFromNfe.js";

describe("cteFromNfe", () => {
  it("soma valor e peso das NF-e e não usa o id interno como chave", () => {
    const r = resumoCargaDasNfes([
      {
        valor_total: 100,
        peso_bruto: 1.5,
        produto_predominante: "SOJA",
        chave_acesso: "41260815025390000121550050000000595100000596",
      },
      { valor_total: 50.25, peso_bruto: 0.5 },
    ]);
    assert.equal(r.valor_carga, 150.25);
    assert.equal(r.peso, 2);
    assert.equal(r.produto_predominante, "SOJA");
  });

  it("mescla chaves sem duplicar e sem misturar NF em papel", () => {
    const { documentos } = mergeDocumentosCte(
      [{ tipo: "nfe", chave: "41260815025390000121550050000000595100000596" }],
      ["41260815025390000121550050000000595100000596", "41260815025390000121550050000000606100000607"],
    );
    assert.equal(documentos.length, 2);
    const papel = mergeDocumentosCte(
      [{ tipo: "nf", numero: "10", chave: "" }],
      ["41260815025390000121550050000000595100000596"],
    );
    assert.equal(papel.conflitoPapel, true);
  });

  it("casa cliente pelo CNPJ da nota, não pelo id", () => {
    const hit = matchClientePorCnpj(
      [{ id: 9, cnpj_cpf: "15025390000121", razao_social: "A" }],
      "15.025.390/0001-21",
    );
    assert.equal(hit.id, 9);
    assert.equal(matchClientePorCnpj([{ id: 9, cnpj_cpf: "1" }], "99"), null);
  });

  it("preenche carga e participantes sem copiar o CFOP da NF-e", () => {
    const r = aplicarNfesCte({
      notas: [
        {
          chave_acesso: "41260815025390000121550050000000595100000596",
          valor_total: 1000,
          peso_bruto: 12.5,
          produto_predominante: "SOJA",
          remetente: {
            cnpj_cpf: "15025390000121",
            razao_social: "EMITENTE",
            uf: "PR",
          },
          destinatario: {
            cnpj_cpf: "11222333000181",
            razao_social: "DEST",
            uf: "SP",
          },
          itens: [{ cfop: "5102", descricao: "SOJA" }],
        },
      ],
      documentosAtuais: [{ tipo: "nfe", chave: "" }],
      clientes: [{ id: 4, cnpj_cpf: "11222333000181", razao_social: "DEST" }],
      caminhoes: [],
    });
    assert.equal(r.formPatch.cliente_id, "4");
    assert.equal(r.formPatch.valor_carga, "1000");
    assert.equal(r.formPatch.peso, "12.5");
    assert.equal(r.formPatch.uf_ini, "PR");
    assert.equal(r.formPatch.uf_fim, "SP");
    assert.equal(r.formPatch.cfop, undefined);
    assert.equal(r.documentos[0].chave, "41260815025390000121550050000000595100000596");
    assert.equal(r.quantidades[0].tipo_medida, "PESO BRUTO");
  });
});
