import { test } from "node:test";
import assert from "node:assert/strict";
import { costPerKmQuerySchema } from "../../src/schemas/reportsSchema.js";

test("costPerKmQuerySchema aceita intervalo e caminhaoId", () => {
  const parsed = costPerKmQuerySchema.parse({
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    caminhaoId: "12",
    entriesLimit: "100",
  });

  assert.equal(parsed.startDate, "2026-01-01");
  assert.equal(parsed.caminhaoId, 12);
  assert.equal(parsed.entriesLimit, 100);
});

test("costPerKmQuerySchema rejeita data inválida", () => {
  assert.throws(() =>
    costPerKmQuerySchema.parse({ startDate: "data-invalida" }),
  );
});

test("costPerKmQuerySchema rejeita entriesLimit acima do máximo", () => {
  assert.throws(() =>
    costPerKmQuerySchema.parse({ entriesLimit: 5000 }),
  );
});
