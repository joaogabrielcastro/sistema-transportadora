import test from "node:test";
import assert from "node:assert/strict";
import {
  montarPayloadMdfe,
  validarMunicipiosDescarga,
} from "../../src/services/fiscal/MdfeService.js";
import { emitirMdfeSchema } from "../../src/schemas/fiscalSchema.js";

/**
 * MDF-e — grupo infMunDescarga (item 2.1). Agrupamento de documentos por
 * município de descarga + cross-check de CT-e vinculado. Funções puras — sem
 * banco.
 */

// Chaves de 44 dígitos com dígito verificador (módulo 11) válido.
const CHAVE_A = "35240000000000000000000000000000000000000000";
const CHAVE_B = "35240000000000000000000000000000000000000018";

const baseInput = {
  data_emissao: "2026-09-01T12:00:00-03:00",
  uf_carregamento: "SP",
  uf_descarregamento: "MG",
  rodoviario: {},
};

test("sem municipios_descarga: payload não ganha infMunDescarga (comportamento atual)", () => {
  const dto = emitirMdfeSchema.parse(baseInput);
  const payload = montarPayloadMdfe(dto, "ABC1D23", [], [], [CHAVE_A]);
  assert.equal(payload.infMunDescarga, undefined);
  assert.deepEqual(payload.documentosVinculados, [{ chaveDfe: CHAVE_A }]);
});

test("com municipios_descarga: agrupa infCTe / infNFe por município", () => {
  const dto = emitirMdfeSchema.parse({
    ...baseInput,
    municipios_descarga: [
      {
        codigo_municipio: "3106200",
        nome_municipio: "Belo Horizonte",
        documentos: [
          { tipo: "cte", chave: CHAVE_A },
          { tipo: "nfe", chave: CHAVE_B },
        ],
      },
      { codigo_municipio: "3550308" },
    ],
  });
  const payload = montarPayloadMdfe(dto, "ABC1D23", [], [], [CHAVE_A]);
  assert.equal(payload.infMunDescarga.length, 2);
  assert.equal(payload.infMunDescarga[0].cMunDescarga, "3106200");
  assert.deepEqual(payload.infMunDescarga[0].infCTe, [{ chCTe: CHAVE_A }]);
  assert.deepEqual(payload.infMunDescarga[0].infNFe, [{ chNFe: CHAVE_B }]);
  assert.equal(payload.infMunDescarga[1].infCTe, undefined);
});

test("validarMunicipiosDescarga: CT-e sem vínculo em cte_ids lança 400", () => {
  const dto = {
    municipios_descarga: [
      { codigo_municipio: "3106200", documentos: [{ tipo: "cte", chave: CHAVE_B }] },
    ],
  };
  assert.throws(
    () => validarMunicipiosDescarga(dto, [CHAVE_A]),
    (err) => {
      assert.equal(err.statusCode, 400);
      return /infMunDescarga/.test(err.message);
    },
  );
});

test("validarMunicipiosDescarga: CT-e vinculado e NF-e livre passam", () => {
  const dto = {
    municipios_descarga: [
      {
        codigo_municipio: "3106200",
        documentos: [
          { tipo: "cte", chave: CHAVE_A },
          { tipo: "nfe", chave: CHAVE_B },
        ],
      },
    ],
  };
  assert.doesNotThrow(() => validarMunicipiosDescarga(dto, [CHAVE_A]));
});

test("validarMunicipiosDescarga: sem o campo, não faz nada", () => {
  assert.doesNotThrow(() => validarMunicipiosDescarga({}, []));
});
