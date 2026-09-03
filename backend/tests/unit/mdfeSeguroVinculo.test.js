import test from "node:test";
import assert from "node:assert/strict";
import { montarPayloadMdfe } from "../../src/services/fiscal/MdfeService.js";
import { emitirMdfeSchema } from "../../src/schemas/fiscalSchema.js";

/**
 * Cobre o grupo `seguros` montado a partir dos campos planos (resp_seg +
 * apólice) e a lista `documentosVinculados` (chaves de CT-e vinculados) no
 * payload do MDF-e. montarPayloadMdfe é função pura — sem banco.
 */

const baseDto = () =>
  emitirMdfeSchema.parse({
    data_emissao: "2026-08-31T12:00:00-03:00",
    uf_carregamento: "SP",
    uf_descarregamento: "MG",
    rodoviario: {},
  });

test("sem campos de seguro -> seguros undefined", () => {
  const payload = montarPayloadMdfe(baseDto(), "ABC1D23", [], [], []);
  assert.equal(payload.seguros, undefined);
  assert.equal(payload.documentosVinculados, undefined);
});

test("resp_seg + apólice -> monta uma entrada em seguros", () => {
  const dto = emitirMdfeSchema.parse({
    data_emissao: "2026-08-31T12:00:00-03:00",
    uf_carregamento: "SP",
    uf_descarregamento: "MG",
    rodoviario: {},
    resp_seg: 2,
    cnpj_seguradora: "12345678000199",
    numero_apolice: "AP-1",
    numero_averbacao: "AV-1",
  });
  const payload = montarPayloadMdfe(dto, "ABC1D23", [], [], []);
  assert.deepEqual(payload.seguros, [
    {
      indicadorResponsavel: 2,
      cnpjSegurador: "12345678000199",
      numeroApolice: "AP-1",
      numerosAverbacao: ["AV-1"],
    },
  ]);
});

test("dto.seguros explícito tem precedência sobre os campos planos", () => {
  const dto = baseDto();
  dto.seguros = [{ indicadorResponsavel: 1 }];
  dto.resp_seg = 2;
  const payload = montarPayloadMdfe(dto, "ABC1D23", [], [], []);
  assert.deepEqual(payload.seguros, [{ indicadorResponsavel: 1 }]);
});

test("chaves de CT-e vinculados entram em documentosVinculados", () => {
  const chaves = ["3".repeat(44), "5".repeat(44)];
  const payload = montarPayloadMdfe(baseDto(), "ABC1D23", [], [], chaves);
  assert.deepEqual(payload.documentosVinculados, [
    { chaveDfe: chaves[0] },
    { chaveDfe: chaves[1] },
  ]);
});
