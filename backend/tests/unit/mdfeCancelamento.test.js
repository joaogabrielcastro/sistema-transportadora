import test from "node:test";
import assert from "node:assert/strict";
import { colunasCancelamentoMdfe } from "../../src/services/fiscal/MdfeService.js";

/**
 * MDF-e — evento de cancelamento estruturado (item 2.3). Função pura que monta
 * as colunas cancelado_* a gravar. Sem banco.
 */

test("mantém status 'cancelado' e registra data/justificativa/protocolo", () => {
  const cols = colunasCancelamentoMdfe("Justificativa com mais de 15 chars", {
    NuProtocolo: "MG123456789",
  });
  assert.equal(cols.status, "cancelado");
  assert.equal(cols.cancelado_justificativa, "Justificativa com mais de 15 chars");
  assert.equal(cols.cancelado_protocolo, "MG123456789");
  assert.ok(cols.cancelado_em instanceof Date);
});

test("sem protocolo na resposta: cancelado_protocolo fica null", () => {
  const cols = colunasCancelamentoMdfe("qualquer justificativa aqui", {});
  assert.equal(cols.cancelado_protocolo, null);
  assert.equal(cols.status, "cancelado");
});

test("resposta indefinida não quebra", () => {
  const cols = colunasCancelamentoMdfe("justificativa suficiente", undefined);
  assert.equal(cols.cancelado_protocolo, null);
  assert.equal(cols.cancelado_justificativa, "justificativa suficiente");
});
