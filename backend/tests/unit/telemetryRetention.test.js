import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RAW_EVENT_RETENTION_DAYS } from "../../src/services/telemetry/telemetryPolicy.js";
import { purgeExpiredTelemetryEvents } from "../../src/services/telemetry/telemetryRetention.js";

describe("telemetry retention", () => {
  it("retenção padrão é 90 dias", () => {
    assert.equal(RAW_EVENT_RETENTION_DAYS, 90);
  });

  it("retentionDays inválido não apaga nada", async () => {
    const result = await purgeExpiredTelemetryEvents({ retentionDays: 0 });
    assert.equal(result.deleted, 0);
    assert.equal(result.cutoff, null);
  });
});
