import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  formatDateTime,
} from "./formatters.js";

test("formatCurrency e formatNumber tratam nulos", () => {
  assert.equal(formatCurrency(null), "R$ 0,00");
  assert.match(formatCurrency(10.5), /R\$/);
  assert.equal(formatNumber(null), "0");
  assert.equal(formatNumber(1500), "1.500");
});

test("formatDate não atrasa DATE UTC em um dia", () => {
  assert.equal(formatDate("2026-12-16"), "16/12/2026");
  assert.equal(formatDate("2026-12-16T00:00:00.000Z"), "16/12/2026");
});

test("formatDateTime inclui hora", () => {
  const formatted = formatDateTime("2026-07-01T15:30:00-03:00");
  assert.match(formatted, /01\/07\/2026/);
  assert.match(formatted, /15:30/);
});
