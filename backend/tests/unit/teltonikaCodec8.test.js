import test from "node:test";
import assert from "node:assert/strict";
import {
  CODEC8_EXTENDED,
  avlAck,
  buildAvlPacket,
  buildCodec8ETestPacket,
  buildCodec8TestPacket,
  buildImeiHandshake,
  buildTeltonikaEventId,
  crc16Ibm,
  imeiAcceptResponse,
  tryParseAvlPacket,
  tryParseImeiHandshake,
} from "../../src/services/telemetry/protocols/teltonika/codec8.js";

test("IMEI handshake parse e rejeita ASCII inválido", () => {
  const ok = tryParseImeiHandshake(buildImeiHandshake("352094081234567"));
  assert.equal(ok.imei, "352094081234567");
  assert.equal(ok.bytesConsumed, 2 + 15);

  assert.equal(tryParseImeiHandshake(Buffer.from([0x00, 0x02, 0x41, 0x42])), null);
  assert.equal(tryParseImeiHandshake(Buffer.from([0x00])), null);
  assert.deepEqual(imeiAcceptResponse(), Buffer.from([0x01]));
});

test("Codec 8 packet roundtrip GPS + ignition", () => {
  const packet = buildCodec8TestPacket({
    recordedAt: "2026-09-21T12:00:00.000Z",
    latitude: -25.4284,
    longitude: -49.2733,
    speedKmh: 72,
    ignition: true,
  });

  const parsed = tryParseAvlPacket(packet);
  assert.ok(parsed);
  assert.equal(parsed.recordCount, 1);
  assert.equal(parsed.bytesConsumed, packet.length);
  assert.equal(parsed.records[0].speedKmh, 72);
  assert.equal(parsed.records[0].ignition, true);
  assert.ok(Math.abs(parsed.records[0].latitude - -25.4284) < 0.000001);
  assert.ok(Math.abs(parsed.records[0].longitude - -49.2733) < 0.000001);
  assert.equal(
    parsed.records[0].recordedAt.toISOString(),
    "2026-09-21T12:00:00.000Z",
  );
});

test("CRC inválido lança TELtonika_CRC", () => {
  const packet = buildCodec8TestPacket();
  packet[packet.length - 1] ^= 0xff;
  assert.throws(() => tryParseAvlPacket(packet), (err) => err.code === "TELTONIKA_CRC");
});

test("buffer incompleto retorna null", () => {
  const packet = buildCodec8TestPacket();
  assert.equal(tryParseAvlPacket(packet.subarray(0, 10)), null);
});

test("event_id estável e limitado", () => {
  const when = "2026-09-21T12:00:00.000Z";
  const id = buildTeltonikaEventId("352094081234567", when, 0);
  assert.equal(id, `352094081234567-${Date.parse(when)}-0`);
  assert.ok(id.length <= 80);
  assert.equal(crc16Ibm(Buffer.from([1, 2, 3])) >= 0, true);
  assert.deepEqual(avlAck(3), Buffer.from([0, 0, 0, 3]));
});

test("Codec 8 com odômetro (AVL 16 em metros)", () => {
  const packet = buildCodec8TestPacket({
    recordedAt: "2026-11-13T12:00:00.000Z",
    odometerM: 120_500_000,
    speedKmh: 55,
  });
  const parsed = tryParseAvlPacket(packet);
  assert.equal(parsed.records[0].speedKmh, 55);
  assert.ok(Math.abs(parsed.records[0].odometerKm - 120_500) < 0.001);
});

test("Codec 8E multi-record roundtrip", () => {
  const packet = buildCodec8ETestPacket({
    records: [
      {
        recordedAt: "2026-11-13T12:00:00.000Z",
        latitude: -25.4284,
        longitude: -49.2733,
        speedKmh: 40,
        ignition: true,
        odometerM: 1000,
      },
      {
        recordedAt: "2026-11-13T12:00:05.000Z",
        latitude: -25.429,
        longitude: -49.274,
        speedKmh: 48,
        ignition: true,
        odometerM: 1100,
      },
    ],
  });
  const parsed = tryParseAvlPacket(packet);
  assert.equal(parsed.codecId, CODEC8_EXTENDED);
  assert.equal(parsed.recordCount, 2);
  assert.equal(parsed.records[1].speedKmh, 48);
  assert.ok(Math.abs(parsed.records[1].odometerKm - 1.1) < 0.0001);
});

test("buildAvlPacket rejeita codec inválido", () => {
  assert.throws(() =>
    buildAvlPacket({
      codecId: 0x0c,
      records: [{ recordedAt: new Date(), latitude: 0, longitude: 0, speedKmh: 0 }],
    }),
  );
});
