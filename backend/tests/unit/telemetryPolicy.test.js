import test from "node:test";
import assert from "node:assert/strict";
import { PLAN_QUOTAS } from "../../src/utils/planQuotas.js";
import {
  RAW_EVENT_RETENTION_DAYS,
  assertDeviceCredentialAllowed,
  commercialQuotasUnchanged,
  shouldAdvanceCurrentState,
  telemetryLimitsForPlan,
} from "../../src/services/telemetry/telemetryPolicy.js";

test("estado atual não recua quando o ponto chega atrasado", () => {
  const newer = "2026-09-21T15:10:00.000Z";
  const older = "2026-09-21T15:05:00.000Z";
  assert.equal(shouldAdvanceCurrentState(newer, older), false);
  assert.equal(shouldAdvanceCurrentState(older, newer), true);
  assert.equal(shouldAdvanceCurrentState(newer, newer), false);
  assert.equal(shouldAdvanceCurrentState(null, newer), true);
});

test("cotas comerciais não mudam e telemetria ainda não é cobrada por evento", () => {
  assert.deepEqual(commercialQuotasUnchanged().starter, PLAN_QUOTAS.starter);
  assert.equal(PLAN_QUOTAS.starter.maxVehicles, 8);
  assert.equal(PLAN_QUOTAS.starter.maxUsers, 2);
  const limits = telemetryLimitsForPlan("starter");
  assert.equal(limits.enforced, false);
  assert.equal(limits.countsEvents, false);
  assert.equal(limits.maxActiveDevices, null);
  assert.equal(limits.rawRetentionDays, RAW_EVENT_RETENTION_DAYS);
  assert.equal(limits.rawRetentionDays, 90);
});

test("credencial de dispositivo rejeita JWT e API_TOKEN", () => {
  const previous = process.env.API_TOKEN;
  process.env.API_TOKEN = "admin-token-que-nao-e-de-rastreador";
  try {
    assert.throws(
      () =>
        assertDeviceCredentialAllowed(
          "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.assinatura",
        ),
      /JWT/,
    );
    assert.throws(
      () => assertDeviceCredentialAllowed(process.env.API_TOKEN),
      /API_TOKEN/,
    );
    assert.equal(
      assertDeviceCredentialAllowed("credencial-de-dispositivo-ok"),
      "credencial-de-dispositivo-ok",
    );
  } finally {
    if (previous === undefined) delete process.env.API_TOKEN;
    else process.env.API_TOKEN = previous;
  }
});
