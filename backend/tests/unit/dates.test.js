import test from "node:test";
import assert from "node:assert/strict";
import { toPrismaDateTime, normalizeDatesForDb } from "../../src/utils/dates.js";

test("toPrismaDateTime aceita Date e yyyy-MM-dd", () => {
  const d = new Date("2026-01-15T00:00:00.000Z");
  assert.equal(toPrismaDateTime(d), d);

  const fromIsoDate = toPrismaDateTime("2026-07-01");
  assert.ok(fromIsoDate instanceof Date);
  assert.equal(fromIsoDate.toISOString().slice(0, 10), "2026-07-01");
});

test("toPrismaDateTime converte dd/MM/yyyy", () => {
  const d = toPrismaDateTime("28/07/2026");
  assert.ok(d instanceof Date);
  assert.equal(d.toISOString().slice(0, 10), "2026-07-28");
});

test("toPrismaDateTime preserva valor não parseável", () => {
  assert.equal(toPrismaDateTime(123), 123);
  assert.equal(toPrismaDateTime("não-é-data"), "não-é-data");
});

test("normalizeDatesForDb converte campos com data no nome", () => {
  const out = normalizeDatesForDb({
    data_gasto: "2026-07-01",
    valor: 10,
  });
  assert.ok(out.data_gasto instanceof Date);
  assert.equal(out.valor, 10);
  assert.equal(normalizeDatesForDb(null), null);
});
