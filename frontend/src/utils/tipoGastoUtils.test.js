import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findCombustivelTipo,
  isCombustivelTipo,
  combustivelTipoId,
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
