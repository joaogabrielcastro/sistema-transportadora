import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFuelDrop } from "../../src/services/telemetry/telemetryFuelWatch.js";

const t0 = Date.parse("2026-11-20T02:00:00Z");
const at = (min) => new Date(t0 + min * 60_000);

test("queda de combustível com o caminhão parado e motor sem consumo", () => {
  const r = evaluateFuelDrop(
    { level: 62, speedKmh: 0, engineL: 152_318, at: at(0) },
    { level: 47, speedKmh: 0, engineL: 152_318, at: at(25) },
  );
  assert.deepEqual(r, { dropPct: 15, engineL: 0 });
});

test("sem alarme falso: movimento, queda pequena, consumo do motor ou intervalo longo", () => {
  // em movimento o nível balança
  assert.equal(evaluateFuelDrop({ level: 62, speedKmh: 70, engineL: null, at: at(0) }, { level: 50, speedKmh: 0, engineL: null, at: at(5) }), null);
  // queda menor que o limite
  assert.equal(evaluateFuelDrop({ level: 62, speedKmh: 0, engineL: null, at: at(0) }, { level: 56, speedKmh: 0, engineL: null, at: at(5) }), null);
  // o motor queimou o combustível (marcha lenta longa)
  assert.equal(evaluateFuelDrop({ level: 62, speedKmh: 0, engineL: 100, at: at(0) }, { level: 50, speedKmh: 0, engineL: 140, at: at(300) }), null);
  // mais de 12 h entre as leituras
  assert.equal(evaluateFuelDrop({ level: 62, speedKmh: 0, engineL: null, at: at(0) }, { level: 40, speedKmh: 0, engineL: null, at: at(13 * 60) }), null);
  // abastecimento (nível sobe) não é queda
  assert.equal(evaluateFuelDrop({ level: 30, speedKmh: 0, engineL: null, at: at(0) }, { level: 90, speedKmh: 0, engineL: null, at: at(20) }), null);
});
