import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveKmUpdate,
  syncKmFromRegistro,
} from "../../src/services/KmCaminhaoService.js";

test("registro com KM maior que o atual deve atualizar", () => {
  const result = resolveKmUpdate(10000, 15000);
  assert.equal(result.apply, true);
  assert.equal(result.km, 15000);
});

test("registro com KM menor que o atual não regride hodômetro", () => {
  const result = resolveKmUpdate(50000, 30000);
  assert.equal(result.apply, false);
  assert.equal(result.reason, "regression");
});

test("registro com mesmo KM não altera", () => {
  const result = resolveKmUpdate(25000, 25000);
  assert.equal(result.apply, false);
  assert.equal(result.reason, "unchanged");
});

test("edição manual permite regressão", () => {
  const result = resolveKmUpdate(50000, 12000, { allowRegression: true });
  assert.equal(result.apply, true);
  assert.equal(result.km, 12000);
});

test("KM inválido é ignorado", () => {
  assert.equal(resolveKmUpdate(1000, -5).apply, false);
  assert.equal(resolveKmUpdate(1000, "abc").apply, false);
  assert.equal(resolveKmUpdate(1000, null).apply, false);
});

test("syncKmFromRegistro exportada", () => {
  assert.equal(typeof syncKmFromRegistro, "function");
});
