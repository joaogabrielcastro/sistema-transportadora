import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatLitersPerKm,
  litersPerKm,
  litersPerKmFromKmPerL,
  relativeTime,
  segmentTrips,
  vehicleStatus,
} from "./telemetryDisplay.js";

test("vehicleStatus prioriza sem sinal, depois movimento, ignição", () => {
  assert.equal(vehicleStatus({ connection: "offline", speedKmh: 80, ignition: true }), "offline");
  assert.equal(vehicleStatus({ connection: "awaiting" }), "awaiting");
  assert.equal(vehicleStatus({ connection: "online", speedKmh: 72, ignition: false }), "moving");
  assert.equal(vehicleStatus({ connection: "online", speedKmh: 0, ignition: true }), "idle");
  assert.equal(vehicleStatus({ connection: "online", speedKmh: 0, ignition: false }), "off");
  assert.equal(vehicleStatus({ connection: "online", speedKmh: null, ignition: null }), "off");
});

test("relativeTime em pt-BR", () => {
  const now = Date.parse("2026-11-17T12:00:00Z");
  assert.equal(relativeTime("2026-11-17T11:59:40Z", now), "agora");
  assert.equal(relativeTime("2026-11-17T11:55:00Z", now), "há 5 min");
  assert.equal(relativeTime("2026-11-17T09:00:00Z", now), "há 3 h");
  assert.equal(relativeTime("2026-11-16T11:00:00Z", now), "há 1 dia");
  assert.equal(relativeTime(null, now), "—");
});

test("litersPerKm = litros ÷ km, com faixa plausível", () => {
  const r = litersPerKm(190, 500);
  assert.equal(r.value, 0.38);
  assert.equal(r.plausible, true);
  assert.equal(litersPerKm(2.7, 473).plausible, false);
  assert.equal(litersPerKm(0, 100).value, null);
  assert.equal(litersPerKm(50, 0).value, null);
  assert.equal(litersPerKm(null, 10).value, null);
  assert.equal(litersPerKmFromKmPerL(2.5).value, 0.4);
  assert.equal(formatLitersPerKm(0.384), "0,38 L/km");
});

test("segmentTrips separa viagens e paradas longas, ignora paradas curtas", () => {
  const t0 = Date.parse("2026-11-17T08:00:00Z");
  const at = (min) => new Date(t0 + min * 60_000).toISOString();
  const pts = [
    { lat: 0, lng: 0, speedKmh: 0, when: at(0), ignition: true, odometerKm: 100 },
    { lat: 0, lng: 0, speedKmh: 0, when: at(10), ignition: true, odometerKm: 100 },
    { lat: 0, lng: 0.01, speedKmh: 60, when: at(20), odometerKm: 101 },
    { lat: 0, lng: 0.02, speedKmh: 0, when: at(21), odometerKm: 102 }, // semáforo (1 min)
    { lat: 0, lng: 0.03, speedKmh: 70, when: at(22), odometerKm: 103 },
    { lat: 0, lng: 0.04, speedKmh: 80, when: at(40), odometerKm: 120 },
    { lat: 0, lng: 0.04, speedKmh: 0, when: at(41), ignition: false, odometerKm: 120 },
    { lat: 0, lng: 0.04, speedKmh: 0, when: at(90), ignition: false, odometerKm: 120 },
  ];
  const segs = segmentTrips(pts);
  assert.deepEqual(segs.map((s) => s.type), ["stop", "trip", "stop"]);
  assert.equal(segs[1].km, 19);
  assert.equal(segs[1].maxSpeedKmh, 80);
  assert.equal(segs[2].durationMs, 49 * 60_000);
});

test("segmentTrips quebra viagem em lacuna longa sem pontos", () => {
  const t0 = Date.parse("2026-11-17T08:00:00Z");
  const at = (min) => new Date(t0 + min * 60_000).toISOString();
  const pts = [
    { lat: 0, lng: 0, speedKmh: 60, when: at(0), odometerKm: 100 },
    { lat: 0, lng: 0.1, speedKmh: 70, when: at(10), odometerKm: 130 },
    { lat: 0, lng: 0.2, speedKmh: 70, when: at(180), odometerKm: 150 },
    { lat: 0, lng: 0.3, speedKmh: 65, when: at(190), odometerKm: 180 },
  ];
  const segs = segmentTrips(pts);
  assert.deepEqual(segs.map((s) => s.type), ["trip", "stop", "trip"]);
  assert.equal(segs[0].km, 30);
  assert.equal(segs[1].durationMs, 170 * 60_000);
});
