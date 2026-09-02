import test from "node:test";
import assert from "node:assert/strict";
import { ciotObrigatorio } from "../../src/utils/fiscalDocs.js";

/**
 * Helper puro de regra do CIOT (item 3.1): critério antigo (contratação de
 * terceiro) + critério novo set/2026 (frota própria em transporte remunerado
 * de carga de terceiros). Não dispara bloqueio em nenhum fluxo.
 */

test("contratação de transportador terceiro: obrigatório (critério antigo)", () => {
  const r = ciotObrigatorio({ contratadoEhTerceiro: true });
  assert.equal(r.obrigatorio, true);
  assert.match(r.motivo, /terceiro/i);
});

test("frota própria + carga de terceiros: obrigatório (critério novo)", () => {
  const r = ciotObrigatorio({ contratadoEhTerceiro: false, cargaPropria: false });
  assert.equal(r.obrigatorio, true);
  assert.match(r.motivo, /frota\s+própria/i);
});

test("frota própria + carga própria: dispensado", () => {
  const r = ciotObrigatorio({ contratadoEhTerceiro: false, cargaPropria: true });
  assert.equal(r.obrigatorio, false);
});

test("sem parâmetros: assume transporte de carga de terceiros -> obrigatório", () => {
  assert.equal(ciotObrigatorio().obrigatorio, true);
});

test("terceiro tem precedência mesmo com cargaPropria=true", () => {
  const r = ciotObrigatorio({ contratadoEhTerceiro: true, cargaPropria: true });
  assert.equal(r.obrigatorio, true);
  assert.match(r.motivo, /terceiro/i);
});
