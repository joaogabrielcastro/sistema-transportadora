import test from "node:test";
import assert from "node:assert/strict";
import {
  coerceDateOnlyString,
  dataStringSchema,
} from "../../src/schemas/shared.js";

test("coerceDateOnlyString preserva YYYY-MM-DD e dd/MM/yyyy", () => {
  assert.equal(coerceDateOnlyString("2026-08-05"), "2026-08-05");
  assert.equal(coerceDateOnlyString("05/08/2026"), "05/08/2026");
});

test("coerceDateOnlyString extrai calendário de ISO datetime da NF-e", () => {
  assert.equal(
    coerceDateOnlyString("2026-08-05T10:00:00-03:00"),
    "2026-08-05",
  );
  assert.equal(
    coerceDateOnlyString("2026-08-05T22:00:00-03:00"),
    "2026-08-05",
  );
  assert.equal(
    coerceDateOnlyString("2026-08-05T13:00:00.000Z"),
    "2026-08-05",
  );
});

test("dataStringSchema aceita ISO e rejeita texto inválido", () => {
  assert.equal(
    dataStringSchema.parse("2026-08-05T10:00:00-03:00"),
    "2026-08-05",
  );
  assert.throws(
    () => dataStringSchema.parse("não é data"),
    /YYYY-MM-DD|dd\/MM\/yyyy/,
  );
});
