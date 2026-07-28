import { test } from "node:test";
import assert from "node:assert/strict";
import { extractApiArray, extractApiData } from "./extractApiArray.js";

test("extractApiArray normaliza formatos da API", () => {
  assert.deepEqual(extractApiArray([1, 2]), [1, 2]);
  assert.deepEqual(extractApiArray({ data: [1] }), [1]);
  assert.deepEqual(extractApiArray({ data: { data: [3] } }), [3]);
  assert.deepEqual(extractApiArray({ data: { x: 1 } }), []);
  assert.deepEqual(extractApiArray(null), []);
});

test("extractApiData retorna objeto data ou passthrough", () => {
  assert.deepEqual(extractApiData({ data: { id: 1 } }), { id: 1 });
  assert.deepEqual(extractApiData({ data: [1] }), { data: [1] });
  assert.deepEqual(extractApiData({ ok: true }), { ok: true });
});
