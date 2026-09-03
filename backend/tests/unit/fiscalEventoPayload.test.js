import test from "node:test";
import assert from "node:assert/strict";
import { montarPayloadCancelamento } from "../../src/services/fiscal/fiscalShared.js";
import { montarPayloadEncerrarMdfe } from "../../src/services/fiscal/MdfeService.js";

/**
 * FASE 0 — corpos de evento acertados com o payload real do provedor:
 *  0.5 encerramento do MDF-e: SÓ tipoAmbiente / chave / protocolo / numeroSequencial
 *  0.6 cancelamento genérico (CT-e e MDF-e): + NumeroProtocolo / NumeroSequencial /
 *      CpfCnpjRemetenteDCe
 * Funções puras.
 */

test("0.5 encerrar MDF-e: exatamente 4 campos, sem UF/município/data", () => {
  const payload = montarPayloadEncerrarMdfe({
    chave_acesso: "35260900000000000000000000000000000000000001",
    numero_protocolo: "135260000000001",
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    "chave",
    "numeroSequencial",
    "protocolo",
    "tipoAmbiente",
  ]);
  assert.equal(payload.chave, "35260900000000000000000000000000000000000001");
  assert.equal(payload.protocolo, "135260000000001");
  assert.equal(payload.numeroSequencial, 1);
  // tipoAmbiente vem do config (2 = homologação por padrão), nunca do body
  assert.equal(payload.tipoAmbiente, 2);
  assert.equal("UF" in payload, false);
  assert.equal("CodigoMunicipio" in payload, false);
  assert.equal("DataEvento" in payload, false);
});

test("0.5 encerrar MDF-e sem protocolo persistido: protocolo undefined (provedor resolve pela chave)", () => {
  const payload = montarPayloadEncerrarMdfe({ chave_acesso: "abc" });
  assert.equal(payload.protocolo, undefined);
  assert.equal(payload.chave, "abc");
});

test("0.6 cancelamento: manda ChaveNF/Justificativa/NumeroProtocolo/NumeroSequencial/DataEvento/CpfCnpjRemetenteDCe", () => {
  const payload = montarPayloadCancelamento({
    chave: "35260900000000000000000000000000000000000009",
    justificativa: "Erro de digitação no valor do frete do documento",
    protocolo: "135260000000009",
    cnpjRemetente: "12345678000199",
  });
  assert.equal(payload.ChaveNF, "35260900000000000000000000000000000000000009");
  assert.equal(payload.Justificativa, "Erro de digitação no valor do frete do documento");
  assert.equal(payload.NumeroProtocolo, "135260000000009");
  assert.equal(payload.NumeroSequencial, 1);
  assert.equal(payload.CpfCnpjRemetenteDCe, "12345678000199");
  assert.ok(typeof payload.DataEvento === "string" && payload.DataEvento.length > 0);
});

test("0.6 cancelamento CT-e sem protocolo/CNPJ: campos ficam undefined, não quebra", () => {
  const payload = montarPayloadCancelamento({
    chave: "chave-cte",
    justificativa: "Justificativa suficientemente longa para o evento",
  });
  assert.equal(payload.NumeroProtocolo, undefined);
  assert.equal(payload.CpfCnpjRemetenteDCe, undefined);
  assert.equal(payload.NumeroSequencial, 1);
});
