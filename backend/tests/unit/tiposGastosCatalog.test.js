import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TIPOS_GASTOS,
  sortTiposGastos,
} from "../../src/utils/tiposGastosCatalog.js";

test("DEFAULT_TIPOS_GASTOS inclui pedágio e multa", () => {
  assert.ok(DEFAULT_TIPOS_GASTOS.includes("Pedágio"));
  assert.ok(DEFAULT_TIPOS_GASTOS.includes("Multa"));
  assert.ok(DEFAULT_TIPOS_GASTOS.includes("Outros"));
});

test("sortTiposGastos prioriza catálogo e deixa Outros por último entre conhecidos", () => {
  const shuffled = [
    { id: 1, nome_tipo: "Outros" },
    { id: 2, nome_tipo: "Pedágio" },
    { id: 3, nome_tipo: "Combustivel" },
    { id: 4, nome_tipo: "Multa" },
  ];

  const sorted = sortTiposGastos(shuffled).map((t) => t.nome_tipo);
  assert.deepEqual(sorted, ["Combustivel", "Pedágio", "Multa", "Outros"]);
});
