import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeKmDrivenFromTimeline,
} from "../../src/services/ReportsService.js";

test("computeKmDrivenFromTimeline com 2+ registros cronológicos", () => {
  const result = computeKmDrivenFromTimeline([
    { date: "2026-01-01", km: 10000 },
    { date: "2026-02-01", km: 15000 },
  ]);
  assert.equal(result.kmDriven, 5000);
  assert.equal(result.kmDataInsufficient, false);
});

test("computeKmDrivenFromTimeline com 1 registro é insuficiente", () => {
  const result = computeKmDrivenFromTimeline([
    { date: "2026-01-01", km: 10000 },
  ]);
  assert.equal(result.kmDriven, null);
  assert.equal(result.kmDataInsufficient, true);
});

test("computeKmDrivenFromTimeline ignora regressão temporal", () => {
  const result = computeKmDrivenFromTimeline([
    { date: "2026-01-01", km: 50000 },
    { date: "2026-02-01", km: 10000 },
  ]);
  assert.equal(result.kmDriven, null);
  assert.equal(result.kmDataInsufficient, true);
});
