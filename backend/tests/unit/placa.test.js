import test from "node:test";
import assert from "node:assert/strict";
import { normalizePlaca, samePlaca } from "../../src/utils/placa.js";

test("normalizePlaca remove hífen e uppercases", () => {
  assert.equal(normalizePlaca("abc-1d23"), "ABC1D23");
  assert.equal(normalizePlaca("  XYZ-9A88 "), "XYZ9A88");
});

test("normalizePlaca retorna null para vazio", () => {
  assert.equal(normalizePlaca(null), null);
  assert.equal(normalizePlaca(""), null);
  assert.equal(normalizePlaca("   "), null);
});

test("samePlaca compara placas normalizadas", () => {
  assert.equal(samePlaca("abc-1d23", "ABC1D23"), true);
  assert.equal(samePlaca("ABC1D23", "XYZ9A88"), false);
  assert.equal(samePlaca(null, "ABC1D23"), false);
  assert.equal(samePlaca("ABC1D23", ""), false);
});
