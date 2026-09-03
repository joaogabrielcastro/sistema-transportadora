import test from "node:test";
import assert from "node:assert/strict";
import { extrairNumeroProtocolo } from "../../src/services/fiscal/fiscalShared.js";
import { extrairNumeroProtocolo as extraidoDoCteService } from "../../src/services/fiscal/CteService.js";

/**
 * PARTE 3 — MDF-e: o protocolo de autorização passa a ser gravado já na emissão
 * (fiscal_mdfes.numero_protocolo), reaproveitando `extrairNumeroProtocolo`, que
 * foi movida para fiscalShared.js. `MdfeService.emitir` chama essa mesma função
 * sobre a resposta do provedor; o cancelamento do MDF-e (que já lia
 * mdfe.numero_protocolo) passa a ter o protocolo mesmo sem encerramento prévio.
 * Função pura — sem banco.
 */

test("extrairNumeroProtocolo é a MESMA função reexportada por CteService (não há cópia divergente)", () => {
  assert.equal(extrairNumeroProtocolo, extraidoDoCteService);
});

test("extrairNumeroProtocolo cobre as grafias plausíveis da resposta de emissão do MDF-e", () => {
  assert.equal(extrairNumeroProtocolo({ protocolo: "135260000000001" }), "135260000000001");
  assert.equal(extrairNumeroProtocolo({ NuProtocolo: "MG999" }), "MG999");
  assert.equal(extrairNumeroProtocolo({ nProt: 7 }), "7");
});

test("extrairNumeroProtocolo: resposta sem protocolo -> null (cancelamento resolve pela chave)", () => {
  assert.equal(extrairNumeroProtocolo({ chave: "abc", numero: 1, status: 1 }), null);
  assert.equal(extrairNumeroProtocolo({}), null);
  assert.equal(extrairNumeroProtocolo(null), null);
});
