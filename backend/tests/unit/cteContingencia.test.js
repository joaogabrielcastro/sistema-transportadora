import test from "node:test";
import assert from "node:assert/strict";
import { emitirCteSchema } from "../../src/schemas/fiscalSchema.js";
import {
  colunasContingenciaTribFed,
  montarPayloadCte,
} from "../../src/services/fiscal/CteService.js";

/**
 * CT-e — contingência (item 1.2: dhCont / xJust / infSolicNFF) e preparação de
 * split payment / pagamento antecipado (item 1.3). Ambos opcionais: preenchido
 * e vazio são válidos, nunca bloqueiam emissão. Funções puras — sem banco.
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

test("contingência vazia é válida e não gera colunas preenchidas", () => {
  const ok = emitirCteSchema.parse(baseCte);
  const cols = colunasContingenciaTribFed(ok);
  assert.equal(cols.dh_contingencia, null);
  assert.equal(cols.justificativa_contingencia, null);
  assert.equal("inf_solic_nff" in cols, false);
  assert.equal("pagamento_antecipado" in cols, false);
});

test("contingência preenchida é válida e mapeia para as colunas", () => {
  const ok = emitirCteSchema.parse({
    ...baseCte,
    contingencia: {
      dh_contingencia: "2026-02-01T09:30:00-03:00",
      justificativa: "SEFAZ indisponível por mais de 30 minutos na emissão",
      inf_solic_nff: { xSolic: "payload-livre-nff" },
    },
  });
  const cols = colunasContingenciaTribFed(ok);
  assert.ok(cols.dh_contingencia instanceof Date);
  assert.match(cols.justificativa_contingencia, /SEFAZ indispon/);
  assert.deepEqual(cols.inf_solic_nff, { xSolic: "payload-livre-nff" });
});

test("payload expõe DhCont / XJust / infSolicNFF quando informados, senão omite", () => {
  const com = montarPayloadCte(
    emitirCteSchema.parse({
      ...baseCte,
      contingencia: { justificativa: "SEFAZ fora do ar durante a janela de emissão" },
    }),
    undefined,
    undefined,
  );
  assert.match(com.XJust, /SEFAZ fora do ar/);

  const sem = montarPayloadCte(emitirCteSchema.parse(baseCte), undefined, undefined);
  assert.equal(sem.DhCont, undefined);
  assert.equal(sem.XJust, undefined);
  assert.equal(sem.infSolicNFF, undefined);
});

test("pagamento_antecipado (split payment) é passthrough opcional", () => {
  const semSplit = emitirCteSchema.parse(baseCte);
  assert.equal("pagamento_antecipado" in colunasContingenciaTribFed(semSplit), false);

  const comSplit = emitirCteSchema.parse({
    ...baseCte,
    pagamento_antecipado: { indPagAntecipado: 1, vAntecip: 50 },
  });
  const cols = colunasContingenciaTribFed(comSplit);
  assert.deepEqual(cols.pagamento_antecipado, { indPagAntecipado: 1, vAntecip: 50 });

  const payload = montarPayloadCte(comSplit, undefined, undefined);
  assert.deepEqual(payload.PagamentoAntecipado, { indPagAntecipado: 1, vAntecip: 50 });
});
