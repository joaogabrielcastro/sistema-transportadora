import test from "node:test";
import assert from "node:assert/strict";
import {
  CODEC8,
  CODEC8_EXTENDED,
  buildAvlPacket,
  tryParseAvlPacket,
} from "../../src/services/telemetry/protocols/teltonika/codec8.js";
import {
  FMS_IO,
  IO,
  interpretFmsIo,
  interpretTeltonikaIo,
  isFmsModel,
  normalizeIbutton,
  teltonikaDrivingEvents,
} from "../../src/services/telemetry/protocols/teltonika/teltonikaIo.js";

const hex = (s) => Buffer.from(s.replace(/\s+/g, ""), "hex");

test("exemplo oficial Teltonika Codec 8 decodifica todos os IOs", () => {
  // Pacote de exemplo da documentação "Teltonika Data Sending Protocols — Codec 8".
  const packet = hex(
    "000000000000003608010000016B40D8EA30010000000000000000000000000000000105021503010101425E0F01F10000601A014E0000000000000000010000C7CF",
  );
  const parsed = tryParseAvlPacket(packet);
  assert.equal(parsed.codecId, CODEC8);
  assert.equal(parsed.recordCount, 1);
  const rec = parsed.records[0];
  assert.equal(rec.recordedAt.toISOString(), "2019-06-10T10:04:46.000Z");
  assert.equal(rec.eventIoId, 1);
  assert.deepEqual(rec.io, {
    21: 3, // GSM signal
    1: 1, // DIN1
    66: 0x5e0f, // tensão externa (mV)
    241: 0x601a, // operadora
    78: "0000000000000000", // iButton vazio
  });
  assert.equal(rec.gsmSignal, 3);
  assert.equal(rec.batteryV, 24.08); // 24079 mV
  assert.equal(rec.ibutton, null);
});

test("exemplo oficial Teltonika Codec 8 Extended (com seção NX) decodifica", () => {
  // Pacote de exemplo da documentação "Codec 8 Extended".
  const packet = hex(
    "000000000000004A8E010000016B412CEE000100000000000000000000000000000000010005000100010100010011001D00010010015E2C880002000B000000003544C87A000E000000001DD7E06A00000100002994",
  );
  const parsed = tryParseAvlPacket(packet);
  assert.equal(parsed.codecId, CODEC8_EXTENDED);
  assert.equal(parsed.recordCount, 1);
  const rec = parsed.records[0];
  assert.equal(rec.io[16], 0x015e2c88); // hodômetro total (m)
  assert.equal(rec.odometerKm, 22949.0);
  assert.equal(rec.io[11], "000000003544C87A");
  assert.equal(rec.io[14], "000000001DD7E06A");
});

test("Codec 8E com vários registros mantém o alinhamento (seção NX)", () => {
  const base = { latitude: -25.43, longitude: -49.27, speedKmh: 60, ignition: true };
  const packet = buildAvlPacket({
    codecId: CODEC8_EXTENDED,
    records: [
      { ...base, recordedAt: "2026-11-20T10:00:00Z", odometerM: 100000 },
      { ...base, recordedAt: "2026-11-20T10:00:30Z", odometerM: 100500, speedKmh: 64 },
      { ...base, recordedAt: "2026-11-20T10:01:00Z", odometerM: 101000, speedKmh: 70 },
    ],
  });
  const parsed = tryParseAvlPacket(packet);
  assert.equal(parsed.recordCount, 3);
  assert.deepEqual(
    parsed.records.map((r) => [r.speedKmh, r.odometerKm]),
    [
      [60, 100],
      [64, 100.5],
      [70, 101],
    ],
  );
});

test("eventos de condução: frenagem brusca, excesso de velocidade, desconexão", () => {
  const packet = buildAvlPacket({
    codecId: CODEC8,
    records: [
      {
        recordedAt: "2026-11-20T10:00:00Z",
        latitude: -25.4,
        longitude: -49.2,
        speedKmh: 82,
        ignition: true,
        eventIoId: IO.GREEN_DRIVING_TYPE,
        io: {
          ones: [
            { id: IO.GREEN_DRIVING_TYPE, value: 2 },
            { id: IO.GREEN_DRIVING_VALUE, value: 45 },
          ],
          twos: [{ id: IO.EXTERNAL_VOLTAGE_MV, value: 27600 }],
          eights: [{ id: IO.IBUTTON, value: "01A2B3C4D5E6F708" }],
        },
      },
      {
        recordedAt: "2026-11-20T10:05:00Z",
        latitude: -25.41,
        longitude: -49.21,
        speedKmh: 104,
        ignition: true,
        eventIoId: IO.OVERSPEEDING,
        io: { ones: [{ id: IO.OVERSPEEDING, value: 104 }] },
      },
      {
        recordedAt: "2026-11-20T10:10:00Z",
        latitude: -25.42,
        longitude: -49.22,
        speedKmh: 0,
        ignition: false,
        eventIoId: IO.UNPLUG,
        io: { ones: [{ id: IO.UNPLUG, value: 1 }] },
      },
    ],
  });
  const [braking, speeding, unplug] = tryParseAvlPacket(packet).records;
  assert.deepEqual(braking.drivingEvents, [
    { tipo: "harsh_braking", valor: 0.45, ioId: IO.GREEN_DRIVING_TYPE },
  ]);
  assert.equal(braking.batteryV, 27.6);
  assert.equal(braking.ibutton, "01A2B3C4D5E6F708");
  assert.deepEqual(speeding.drivingEvents, [
    { tipo: "overspeed", valor: 104, ioId: IO.OVERSPEEDING },
  ]);
  assert.deepEqual(unplug.drivingEvents.map((e) => e.tipo), ["unplug"]);
});

test("registro periódico comum não gera evento", () => {
  assert.deepEqual(
    teltonikaDrivingEvents({ io: new Map([[IO.IGNITION, 1], [IO.MOVEMENT, 1]]) }),
    [],
  );
  // Fim de excesso de velocidade (valor 0) e reconexão (0) não contam.
  assert.deepEqual(
    teltonikaDrivingEvents({ io: { 255: 0, 252: 0 } }),
    [],
  );
});

test("interpretação de IOs e iButton", () => {
  const r = interpretTeltonikaIo({ 239: 0, 16: 123456, 12: 5500, 66: 12650, 21: 5 });
  assert.equal(r.ignition, false);
  assert.equal(r.odometerKm, 123.456);
  assert.equal(r.fuelConsumedL, 5.5);
  assert.equal(r.batteryV, 12.65);
  assert.equal(r.gsmSignal, 5);
  assert.equal(normalizeIbutton("1a2b"), "0000000000001A2B");
  assert.equal(normalizeIbutton("0000000000000000"), null);
  assert.equal(normalizeIbutton(null), null);
});

test("FMC650: modelo com FMS e leitura dos dados do caminhão", () => {
  assert.equal(isFmsModel("FMC650"), true);
  assert.equal(isFmsModel("Teltonika fmm650"), true);
  assert.equal(isFmsModel("FMB640"), true);
  assert.equal(isFmsModel("FMC130"), false);
  assert.equal(isFmsModel("FMB920"), false);
  assert.equal(isFmsModel(null), false);
  const r = interpretFmsIo({
    [FMS_IO.ENGINE_TOTAL_FUEL_USED_L]: 152340,
    [FMS_IO.FUEL_LEVEL_PCT]: 63,
    [FMS_IO.ENGINE_SPEED_RPM]: 1340,
  });
  assert.deepEqual(r, { fuelConsumedL: 152340, fuelLevelPct: 63, engineRpm: 1340 });
  // fora da faixa (102 = "não disponível" na FMS) ou ausente → null
  assert.deepEqual(interpretFmsIo({ 87: 102 }), { fuelConsumedL: null, fuelLevelPct: null, engineRpm: null });
});
