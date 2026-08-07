import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcularVidaUtilPneu } from "./pneuVidaUtil.js";

describe("calcularVidaUtilPneu", () => {
  it("pneu novo (km instalação = km atual) retorna 100%", () => {
    const r = calcularVidaUtilPneu(598245, 598245, 200000);
    assert.equal(r.kmRodado, 0);
    assert.equal(r.vidaUtilRestante, 200000);
    assert.equal(r.percentualVidaUtil, 100);
  });

  it("calcula % restante com km rodados", () => {
    const r = calcularVidaUtilPneu(150000, 100000, 100000);
    assert.equal(r.kmRodado, 50000);
    assert.equal(r.vidaUtilRestante, 50000);
    assert.equal(r.percentualVidaUtil, 50);
  });

  it("esgotado (km rodados > vida útil) retorna 0%", () => {
    const r = calcularVidaUtilPneu(598245, 100000, 200000);
    assert.equal(r.kmRodado, 498245);
    assert.equal(r.vidaUtilRestante, 200000 - 498245);
    assert.equal(r.percentualVidaUtil, 0);
  });

  it("não usa truthiness de 0 (regressão)", () => {
    const r = calcularVidaUtilPneu(0, 0, 80000);
    assert.equal(r.kmRodado, 0);
    assert.equal(r.percentualVidaUtil, 100);
  });

  it("sem vida útil cadastrada retorna só km rodado", () => {
    const r = calcularVidaUtilPneu(100, 50, null);
    assert.equal(r.kmRodado, 50);
    assert.equal(r.percentualVidaUtil, null);
  });

  it("dados incompletos retornam null", () => {
    assert.equal(calcularVidaUtilPneu(null, 10, 100).kmRodado, null);
    assert.equal(calcularVidaUtilPneu(10, null, 100).kmRodado, null);
  });
});
