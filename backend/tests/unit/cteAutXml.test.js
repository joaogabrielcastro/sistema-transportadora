import test from "node:test";
import assert from "node:assert/strict";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";
import {
  normalizarAutXmlCte,
  montarAutXmlCte,
  montarPayloadCte,
} from "../../src/services/fiscal/CteService.js";

/**
 * CT-e — grupo autXML (item 1.1): terceiros autorizados a baixar o XML.
 * Puramente opcional — 0 registros é válido; nenhuma exigência de preenchimento.
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

test("schema aceita CT-e sem aut_xml (0 registros é válido)", () => {
  const ok = emitirCteSchema.parse(baseCte);
  assert.equal(ok.aut_xml, undefined);
  assert.deepEqual(normalizarAutXmlCte(ok), []);
});

test("schema aceita aut_xml como lista vazia", () => {
  const ok = emitirCteSchema.parse({ ...baseCte, aut_xml: [] });
  assert.deepEqual(ok.aut_xml, []);
  assert.deepEqual(normalizarAutXmlCte(ok), []);
});

test("aut_xml com 2 registros (string e objeto) normaliza para 2 linhas", () => {
  const ok = emitirCteSchema.parse({
    ...baseCte,
    aut_xml: ["12.345.678/0001-99", { cnpj_cpf: "98765432000188" }],
  });
  const linhas = normalizarAutXmlCte(ok);
  assert.equal(linhas.length, 2);
  assert.deepEqual(linhas, [
    { cnpj_cpf: "12345678000199" },
    { cnpj_cpf: "98765432000188" },
  ]);
});

test("montarAutXmlCte: undefined quando não há autorizados; array quando há", () => {
  assert.equal(montarAutXmlCte(emitirCteSchema.parse(baseCte)), undefined);
  const out = montarAutXmlCte(
    emitirCteSchema.parse({ ...baseCte, aut_xml: ["12345678000199"] }),
  );
  assert.deepEqual(out, [{ CnpjCpf: "12345678000199" }]);
});

test("montarPayloadCte expõe AutXML só quando há autorizados", () => {
  const com = montarPayloadCte(
    emitirCteSchema.parse({
      ...baseCte,
      aut_xml: ["12345678000199", "98765432000188"],
    }),
    undefined,
    undefined,
  );
  assert.equal(com.AutXML.length, 2);

  const sem = montarPayloadCte(emitirCteSchema.parse(baseCte), undefined, undefined);
  assert.equal(sem.AutXML, undefined);
});
