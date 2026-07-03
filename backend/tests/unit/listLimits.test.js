import test from "node:test";
import assert from "node:assert/strict";
import { parseListLimit, MAX_LIST_LIMIT } from "../../src/utils/listLimits.js";

test("parseListLimit usa default quando inválido", () => {
  assert.equal(parseListLimit(undefined, 10), 10);
  assert.equal(parseListLimit("abc", 25), 25);
});

test("parseListLimit respeita teto máximo", () => {
  assert.equal(parseListLimit("500"), MAX_LIST_LIMIT);
  assert.equal(parseListLimit("0", 10), 10);
  assert.equal(parseListLimit("-5", 10), 10);
});

test("parseListLimit aceita valores válidos", () => {
  assert.equal(parseListLimit("50"), 50);
  assert.equal(parseListLimit("1"), 1);
});
