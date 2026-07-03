import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDateBr,
  finalizeOrdemVars,
} from "../../src/utils/ordemColetaFormat.js";

test("formatDateBr converte ISO para dd/mm/aaaa", () => {
  assert.equal(formatDateBr("2026-05-19"), "19/05/2026");
  assert.equal(formatDateBr("19/05/2026"), "19/05/2026");
  assert.equal(formatDateBr(""), "");
});

test("finalizeOrdemVars monta coleta prevista e horários padrão", () => {
  const vars = finalizeOrdemVars({
    data_coleta_prevista: "2026-05-20",
    horario_previsto_coleta: "14:30",
    placa_carreta_1: "ABC1D23",
    placa_carreta_2: "XYZ9Z99",
  });

  assert.equal(vars.data_coleta_prevista, "20/05/2026");
  assert.equal(vars.coleta_prevista_exibicao, "20/05/2026 às 14:30");
  assert.equal(vars.placas_carretas_exibicao, "ABC1D23 / XYZ9Z99");
  assert.equal(vars.horario_chegada_coleta, "____:____");
});
