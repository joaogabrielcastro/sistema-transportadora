import test from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
import {
  TELEMETRY_MAX_SPEED_KMH,
  telemetryIngestSchema,
} from "../../src/schemas/telemetrySchema.js";

const valid = {
  event_id: "evt-000001",
  recorded_at: "2026-09-21T22:30:00.000Z",
  latitude: -25.4284,
  longitude: -49.2733,
  speed_kmh: 72,
  ignition: true,
};

test("payload mínimo de ingestão é aceito", () => {
  const parsed = telemetryIngestSchema.parse(valid);
  assert.equal(parsed.event_id, "evt-000001");
  assert.equal(parsed.ignition, true);
});

test("rejeita latitude, longitude, velocidade, event_id e recorded_at inválidos", () => {
  const cases = [
    { ...valid, latitude: 90.1 },
    { ...valid, latitude: -90.1 },
    { ...valid, longitude: 180.1 },
    { ...valid, longitude: -180.1 },
    { ...valid, speed_kmh: -1 },
    { ...valid, speed_kmh: TELEMETRY_MAX_SPEED_KMH + 1 },
    { ...valid, event_id: "   " },
    { ...valid, event_id: "" },
    { ...valid, recorded_at: "21/09/2026" },
    { ...valid, recorded_at: "2026-09-21" },
  ];

  for (const body of cases) {
    assert.throws(() => telemetryIngestSchema.parse(body), ZodError);
  }
});

test("rejeita tenant_id e vehicle_id no payload", () => {
  assert.throws(
    () => telemetryIngestSchema.parse({ ...valid, tenant_id: 2 }),
    ZodError,
  );
  assert.throws(
    () => telemetryIngestSchema.parse({ ...valid, vehicle_id: 9 }),
    ZodError,
  );
});
