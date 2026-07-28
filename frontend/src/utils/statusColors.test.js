import { test } from "node:test";
import assert from "node:assert/strict";
import { getStatusConfig } from "./statusColors.js";

test("getStatusConfig status conhecidos e default", () => {
  assert.match(getStatusConfig("Em Uso"), /green/);
  assert.match(getStatusConfig("novo no estoque"), /blue/);
  assert.match(getStatusConfig("desconhecido"), /gray/);
});

test("getStatusConfig vehicle e record", () => {
  assert.match(getStatusConfig("ativo", "vehicle"), /green/);
  assert.match(getStatusConfig("gasto", "record"), /blue/);
  assert.match(getStatusConfig("x", "vehicle"), /slate/);
});
