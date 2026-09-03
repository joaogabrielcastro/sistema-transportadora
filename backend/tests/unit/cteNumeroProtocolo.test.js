import test from "node:test";
import assert from "node:assert/strict";
import { extrairNumeroProtocolo } from "../../src/services/fiscal/CteService.js";

/**
 * PARTE 3 — o CT-e passa a persistir o número do protocolo de autorização
 * devolvido pelo provedor na emissão, para reutilizá-lo no cancelamento
 * (NumeroProtocolo). O nome exato do campo na resposta não está confirmado em
 * sandbox, então o extrator tenta as grafias plausíveis. Função pura.
 */

test("extrairNumeroProtocolo: aceita as grafias plausíveis do provedor", () => {
  assert.equal(extrairNumeroProtocolo({ protocolo: "135260000000001" }), "135260000000001");
  assert.equal(extrairNumeroProtocolo({ Protocolo: "2" }), "2");
  assert.equal(extrairNumeroProtocolo({ numeroProtocolo: "3" }), "3");
  assert.equal(extrairNumeroProtocolo({ NumeroProtocolo: "4" }), "4");
  assert.equal(extrairNumeroProtocolo({ NuProtocolo: "5" }), "5");
  assert.equal(extrairNumeroProtocolo({ nProt: "6" }), "6");
});

test("extrairNumeroProtocolo: número é normalizado para string", () => {
  assert.equal(extrairNumeroProtocolo({ protocolo: 135260000000001 }), "135260000000001");
});

test("extrairNumeroProtocolo: sem protocolo na resposta -> null (cancelamento resolve pela chave)", () => {
  assert.equal(extrairNumeroProtocolo({ chave: "abc", numero: 1 }), null);
  assert.equal(extrairNumeroProtocolo({}), null);
  assert.equal(extrairNumeroProtocolo(null), null);
  assert.equal(extrairNumeroProtocolo(undefined), null);
});
