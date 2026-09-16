import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findCombustivelTipo,
  isCombustivelTipo,
  combustivelTipoId,
  tiposGastosFinanceiros,
  classifyTipoGasto,
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
  assert.equal(
    isCombustivelTipo(20, [
      { id: 2, nome_tipo: "Combustível" },
      { id: 20, nome_tipo: "Combustivel" },
    ]),
    true,
  );
});

test("tiposGastosFinanceiros remove tipo Manutenção", () => {
  const financeiros = tiposGastosFinanceiros([
    ...tipos,
    { id: 3, nome_tipo: "Manutenção" },
  ]);
  assert.equal(financeiros.length, 2);
  assert.ok(financeiros.every((t) => t.id !== 3));
});

test("tiposGastosFinanceiros remove Combustível duplicado", () => {
  const financeiros = tiposGastosFinanceiros([
    { id: 1, nome_tipo: "Combustivel" },
    { id: 8, nome_tipo: "Combustível" },
    { id: 2, nome_tipo: "Pedágio" },
  ]);
  const combust = financeiros.filter((t) => /combust/i.test(t.nome_tipo));
  assert.equal(combust.length, 1);
  assert.equal(combust[0].nome_tipo, "Combustível");
});

test("classifyTipoGasto cobre multa e demais tipos", () => {
  assert.equal(classifyTipoGasto("Multa"), "multa");
  assert.equal(classifyTipoGasto("Pedágio"), "pedagio");
  assert.equal(classifyTipoGasto("Seguro"), "seguro");
  assert.equal(classifyTipoGasto("Outros"), "outros");
});
