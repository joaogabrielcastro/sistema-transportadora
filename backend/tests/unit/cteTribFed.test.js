import test from "node:test";
import assert from "node:assert/strict";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";
import {
  colunasContingenciaTribFed,
  montarImpCte,
  montarPayloadCte,
} from "../../src/services/fiscal/CteService.js";

/**
 * CT-e — grupo infTribFed (item 1.4): SÓ os totalizadores vPIS / vCOFINS.
 * Sem CST/base/alíquota (isso é da NF-e, não do CT-e). Opcional: presente e
 * ausente são válidos. Funções puras — sem banco.
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

test("sem trib_fed: colunas PIS/COFINS ficam null e imp não ganha infTribFed", () => {
  const ok = emitirCteSchema.parse(baseCte);
  const cols = colunasContingenciaTribFed(ok);
  assert.equal(cols.pis_valor, null);
  assert.equal(cols.cofins_valor, null);
  // montarImpCte preserva o payload atual (sem imposto => undefined).
  assert.equal(montarImpCte(ok), undefined);
});

test("com trib_fed: totalizadores vão para colunas e para imp.infTribFed", () => {
  const ok = emitirCteSchema.parse({
    ...baseCte,
    trib_fed: { pis_valor: 1.65, cofins_valor: 7.6 },
  });
  const cols = colunasContingenciaTribFed(ok);
  assert.equal(cols.pis_valor, 1.65);
  assert.equal(cols.cofins_valor, 7.6);

  const imp = montarImpCte(ok);
  assert.deepEqual(imp.infTribFed, { vPIS: 1.65, vCOFINS: 7.6 });
  // Não inventa CST/base/alíquota — só os dois totalizadores.
  assert.deepEqual(Object.keys(imp.infTribFed).sort(), ["vCOFINS", "vPIS"]);
});

test("trib_fed convive com o objeto imposto livre sem descartá-lo", () => {
  const ok = emitirCteSchema.parse({
    ...baseCte,
    imposto: { ICMS: { CST: "00" } },
    trib_fed: { pis_valor: 2 },
  });
  const imp = montarImpCte(ok);
  assert.deepEqual(imp.ICMS, { CST: "00" });
  assert.equal(imp.infTribFed.vPIS, 2);
});

test("montarPayloadCte: Imposto sem infTribFed quando trib_fed ausente", () => {
  const payload = montarPayloadCte(emitirCteSchema.parse(baseCte), undefined, undefined);
  assert.equal(payload.Imposto, undefined);
});
