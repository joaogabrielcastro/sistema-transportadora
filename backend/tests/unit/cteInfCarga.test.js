import test from "node:test";
import assert from "node:assert/strict";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";
import { montarCarga } from "../../src/services/fiscal/CteService.js";

/**
 * infCarga do CT-e (item 1.3): campos planos + grupo infQ (quantidades).
 * montarCarga é função pura — sem banco. Cobre também a preservação da saída
 * atual quando os campos novos não vêm.
 */

const CHAVE_44 = "35240000000000000000000000000000000000000000";
const baseCte = {
  cliente_id: 1,
  tipo_cte: "0",
  cfop: "6353",
  natureza_operacao: "Transporte",
  dt_emissao: "2026-02-01T10:00:00-03:00",
  servico: { valor_prestacao: 100 },
  tomador: { cpf_cnpj: "12345678000199" },
};

test("schema aceita infCarga plano + quantidades", () => {
  const ok = emitirCteSchema.parse({
    ...baseCte,
    carga: {
      peso: 15000,
      valor_carga: 42000.5,
      produto_predominante: "Soja",
      outras_caracteristicas: "Granel",
      quantidades: [
        { codigo_unidade: "01", tipo_medida: "PESO BRUTO", quantidade: 15000 },
      ],
    },
  });
  assert.equal(ok.carga.valor_carga, 42000.5);
  assert.equal(ok.carga.quantidades[0].quantidade, 15000);
});

test("montarCarga sem campos novos: saída idêntica à atual", () => {
  assert.equal(montarCarga({}), undefined);
  assert.deepEqual(montarCarga({ carga: { peso: 15000, valor_carga: 200 } }), {
    peso: 15000,
    valor_carga: 200,
  });
});

test("montarCarga: chave_nfe_referenciada continua virando Documentos[].chave", () => {
  const carga = montarCarga({ carga: { peso: 1 }, chave_nfe_referenciada: CHAVE_44 });
  assert.deepEqual(carga.documentos, [{ chave: CHAVE_44 }]);
});

test("montarCarga: documentos[] infDoc entram em Documentos[]", () => {
  const carga = montarCarga({
    carga: { peso: 1 },
    documentos: [
      { tipo: "nfe", chave: CHAVE_44 },
      { tipo: "nf", numero: "123", serie: "1" },
    ],
  });
  assert.equal(carga.documentos.length, 2);
  assert.equal(carga.documentos[0].chave, CHAVE_44);
  assert.equal(carga.documentos[1].numero, "123");
});

test("montarCarga: quantidades fluem pelo spread de carga", () => {
  const carga = montarCarga({
    carga: { peso: 1, quantidades: [{ codigo_unidade: "01", quantidade: 5 }] },
  });
  assert.equal(carga.quantidades[0].quantidade, 5);
});
