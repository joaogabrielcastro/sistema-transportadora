import { test } from "node:test";
import assert from "node:assert/strict";
import {
  camposDetalheGasto,
  compactDetalhes,
  defaultStatusForKind,
  detalhesFromRaw,
} from "./gastoDetalhes.js";

test("multa tem AIT, órgão e gravidade", () => {
  const nomes = camposDetalheGasto("multa").map((c) => c.name);
  assert.ok(nomes.includes("numero_ait"));
  assert.ok(nomes.includes("orgao"));
  assert.ok(nomes.includes("gravidade"));
});

test("defaultStatusForKind: multa pendente, combustível pago", () => {
  assert.equal(defaultStatusForKind("multa"), "pendente");
  assert.equal(defaultStatusForKind("ipva"), "pendente");
  assert.equal(defaultStatusForKind("combustivel"), "pago");
});

test("compactDetalhes remove vazios", () => {
  assert.equal(compactDetalhes({ a: "", b: "  " }), null);
  assert.deepEqual(compactDetalhes({ a: "x", b: "" }), { a: "x" });
});

test("detalhesFromRaw ignora array e nulo", () => {
  assert.deepEqual(detalhesFromRaw(null), {});
  assert.deepEqual(detalhesFromRaw(["x"]), {});
  assert.deepEqual(detalhesFromRaw({ numero_ait: 1 }), { numero_ait: "1" });
});
