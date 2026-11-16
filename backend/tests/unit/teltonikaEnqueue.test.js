import test from "node:test";
import assert from "node:assert/strict";
import { isValidTeltonikaRecord } from "../../src/services/telemetry/protocols/teltonika/tcpServer.js";
import { buildTeltonikaEventId } from "../../src/services/telemetry/protocols/teltonika/codec8.js";

test("isValidTeltonikaRecord filtra coordenada e velocidade inválidas", () => {
  assert.equal(
    isValidTeltonikaRecord({
      latitude: -25.4,
      longitude: -49.2,
      speedKmh: 40,
    }),
    true,
  );
  assert.equal(
    isValidTeltonikaRecord({
      latitude: 91,
      longitude: -49.2,
      speedKmh: 40,
    }),
    false,
  );
  assert.equal(
    isValidTeltonikaRecord({
      latitude: -25.4,
      longitude: -49.2,
      speedKmh: 999,
    }),
    false,
  );
});

test("buildTeltonikaEventId é idempotente para o mesmo record", () => {
  const a = buildTeltonikaEventId("352094081234567", "2026-09-21T12:00:00.000Z", 0);
  const b = buildTeltonikaEventId("352094081234567", "2026-09-21T12:00:00.000Z", 0);
  assert.equal(a, b);
});
