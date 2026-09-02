import test from "node:test";
import assert from "node:assert/strict";
import {
  regimeSimplesNacional,
  validarImpostoCte,
  montarImpCte,
  assertEmpresaCrt,
} from "../../src/services/fiscal/CteService.js";

/**
 * Grupo imp do CT-e 4.0 (item 1.1): ICMS + IBS/CBS. Funções puras — sem banco.
 * IBS/CBS é obrigatório na emissão nova para emitente fora do Simples Nacional
 * a partir de 05/01/2026.
 */

const DEPOIS = "2026-02-01T10:00:00-03:00";
const ANTES = "2025-12-20T10:00:00-03:00";
const empresaSN = { crt: 1 };
const empresaNormal = { crt: 3 };
const ibscbsOk = { cst: "000", base: 1000, cbs_valor: 90, ibs_uf_valor: 60 };

test("regimeSimplesNacional: 1, 2 e 4 são SN/isentos de IBSCBS; só 3 (regime normal) não", () => {
  assert.equal(regimeSimplesNacional(1), true);
  assert.equal(regimeSimplesNacional(2), true);
  assert.equal(regimeSimplesNacional(4), true);
  assert.equal(regimeSimplesNacional(3), false);
});

test("CRT 2 (SN excesso de sublimite) sem IBSCBS: não lança", () => {
  assert.doesNotThrow(() =>
    validarImpostoCte({ icms: { cst: "00" } }, { crt: 2 }, DEPOIS),
  );
});

test("Simples Nacional sem IBSCBS: não lança", () => {
  assert.doesNotThrow(() =>
    validarImpostoCte({ icms: { cst: "00" } }, empresaSN, DEPOIS),
  );
});

test("regime normal sem IBSCBS após 05/01/2026: lança", () => {
  assert.throws(
    () => validarImpostoCte({ icms: { cst: "00" } }, empresaNormal, DEPOIS),
    /IBS\/CBS/,
  );
});

test("regime normal com IBSCBS: não lança", () => {
  assert.doesNotThrow(() =>
    validarImpostoCte({ ibscbs: ibscbsOk }, empresaNormal, DEPOIS),
  );
});

test("regime normal sem IBSCBS mas emissão anterior a 05/01/2026: não lança", () => {
  assert.doesNotThrow(() =>
    validarImpostoCte({ icms: { cst: "00" } }, empresaNormal, ANTES),
  );
});

test("montarImpCte sem campos novos devolve exatamente dto.imposto", () => {
  const imposto = { ICMS: { CST: "00" }, algoLivre: 1 };
  assert.equal(montarImpCte({ imposto }), imposto);
  assert.equal(montarImpCte({}), undefined);
});

test("montarImpCte ICMS00: monta bloco ICMS com base/aliq/valor", () => {
  const imp = montarImpCte({
    icms: { cst: "00", base: 1000, aliquota: 12, valor: 120 },
  });
  assert.equal(imp.ICMS.CST, "00");
  assert.equal(imp.ICMS.vBC, 1000);
  assert.equal(imp.ICMS.pICMS, 12);
  assert.equal(imp.ICMS.vICMS, 120);
});

test("montarImpCte isento (CST 40) sem valor: bloco ICMS só com CST", () => {
  const imp = montarImpCte({ icms: { cst: "40" } });
  assert.equal(imp.ICMS.CST, "40");
  assert.equal(imp.ICMS.vICMS, undefined);
});

test("montarImpCte mescla IBSCBS sobre imposto livre sem descartar o que veio", () => {
  const imp = montarImpCte({
    imposto: { ICMS: { CST: "90" }, vTotTrib: 5 },
    ibscbs: ibscbsOk,
  });
  assert.equal(imp.vTotTrib, 5);
  assert.equal(imp.ICMS.CST, "90");
  assert.equal(imp.IBSCBS.CST, "000");
  assert.equal(imp.IBSCBS.vCBS, 90);
});

test("assertEmpresaCrt: empresa sem CRT lança erro claro (não crash)", () => {
  assert.throws(() => assertEmpresaCrt({ crt: null }), /CRT/);
  assert.throws(() => assertEmpresaCrt({}), /CRT/);
  assert.doesNotThrow(() => assertEmpresaCrt({ crt: 3 }));
});
