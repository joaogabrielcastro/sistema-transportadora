import test from "node:test";
import assert from "node:assert/strict";
import { CaminhaoService } from "../../src/services/CaminhaoService.js";

test("buildDuplicateErrors detecta número e placa de carreta", () => {
  const erros = CaminhaoService.buildDuplicateErrors(
    [
      {
        placa: "ABC1D23",
        numero_carreta_1: 100,
        placa_carreta_1: "CAR1A23",
        numero_carreta_2: null,
        placa_carreta_2: null,
        numero_cavalo: 55,
      },
    ],
    {
      numero_carreta_1: 100,
      placa_carreta_1: "car-1a23",
      numero_carreta_2: null,
      placa_carreta_2: null,
      numero_cavalo: 55,
    },
  );

  const messages = Array.from(erros);
  assert.ok(messages.some((m) => /Número de carreta 100/.test(m)));
  assert.ok(messages.some((m) => /Placa de carreta CAR1A23/.test(m)));
  assert.ok(messages.some((m) => /Número do cavalo 55/.test(m)));
});

test("buildDuplicateErrors retorna vazio sem conflitos", () => {
  const erros = CaminhaoService.buildDuplicateErrors(
    [{ placa: "XYZ9A88", numero_carreta_1: 1, numero_cavalo: 2 }],
    { numero_carreta_1: 99, numero_cavalo: 98 },
  );
  assert.equal(erros.size, 0);
});

test("pesquisarCaminhoes exige termo com 2+ chars", async () => {
  await assert.rejects(
    () => CaminhaoService.pesquisarCaminhoes(1, "a"),
    /pelo menos/i,
  );
});
