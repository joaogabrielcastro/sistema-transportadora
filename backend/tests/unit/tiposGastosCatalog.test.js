import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TIPOS_GASTOS,
  sortTiposGastos,
  selectCanonicalTipo,
  dedupeTiposGastos,
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

test("selectCanonicalTipo prefere a grafia do catálogo (Combustível)", () => {
  const keeper = selectCanonicalTipo([
    { id: 1, nome_tipo: "Combustivel" },
    { id: 8, nome_tipo: "Combustível" },
  ]);
  assert.equal(keeper.id, 8);
  assert.equal(keeper.nome_tipo, "Combustível");
});

test("dedupeTiposGastos deixa um só Combustível", () => {
  const deduped = dedupeTiposGastos([
    { id: 1, nome_tipo: "Combustivel" },
    { id: 8, nome_tipo: "Combustível" },
    { id: 2, nome_tipo: "Pedágio" },
  ]);
  assert.equal(deduped.filter((t) => /combust/i.test(t.nome_tipo)).length, 1);
  assert.equal(deduped.find((t) => /combust/i.test(t.nome_tipo)).nome_tipo, "Combustível");
});
