import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findCombustivelTipo,
  isCombustivelTipo,
  combustivelTipoId,
  tiposGastosFinanceiros,
} from "./tipoGastoUtils.js";

const tipos = [
  { id: 1, nome_tipo: "Pedágio" },
  { id: 2, nome_tipo: "Combustível" },
];

test("findCombustivelTipo ignora acentos", () => {
  assert.equal(findCombustivelTipo(tipos)?.id, 2);
  assert.equal(findCombustivelTipo([{ id: 1, nome_tipo: "Óleo" }]), null);
});

test("isCombustivelTipo e combustivelTipoId", () => {
  assert.equal(isCombustivelTipo(2, tipos), true);
  assert.equal(isCombustivelTipo(1, tipos), false);
  assert.equal(isCombustivelTipo(null, tipos), false);
  assert.equal(combustivelTipoId(tipos), 2);
  assert.equal(combustivelTipoId([]), null);
});

test("tiposGastosFinanceiros remove tipo Manutenção", () => {
  const financeiros = tiposGastosFinanceiros([
    ...tipos,
    { id: 3, nome_tipo: "Manutenção" },
  ]);
  assert.equal(financeiros.length, 2);
  assert.ok(financeiros.every((t) => t.id !== 3));
});
