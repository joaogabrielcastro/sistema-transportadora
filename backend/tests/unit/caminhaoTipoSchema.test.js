import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { caminhaoSchema, vinculoComposicaoSchema } from "../../src/schemas/caminhaoSchema.js";

describe("caminhaoSchema tipos", () => {
  it("aceita truck, cavalo e carreta", () => {
    for (const tipo of ["truck", "cavalo", "carreta"]) {
      const parsed = caminhaoSchema.parse({
        placa: "ABC1D23",
        qtd_pneus: 6,
        km_atual: 0,
        tipo_veiculo: tipo,
        config_eixos: "6x2",
        com_4_eixo: true,
        chassi: "9BVTEST123",
        empresa: "Solofino",
      });
      assert.equal(parsed.tipo_veiculo, tipo);
      assert.equal(parsed.config_eixos, "6x2");
      assert.equal(parsed.com_4_eixo, true);
    }
  });

  it("aceita placa no formato antigo (ABC1234)", () => {
    const parsed = caminhaoSchema.parse({
      placa: "ABC1234",
      qtd_pneus: 6,
    });
    assert.equal(parsed.placa, "ABC1234");
  });

  it("rejeita placa com formato inválido", () => {
    assert.throws(() =>
      caminhaoSchema.parse({
        placa: "MA67076",
        qtd_pneus: 6,
      }),
    );
  });

  it("default tipo_veiculo = truck", () => {
    const parsed = caminhaoSchema.parse({
      placa: "ABC1D23",
      qtd_pneus: 6,
    });
    assert.equal(parsed.tipo_veiculo, "truck");
  });

  it("rejeita tipo inválido", () => {
    assert.throws(() =>
      caminhaoSchema.parse({
        placa: "ABC1D23",
        qtd_pneus: 6,
        tipo_veiculo: "bitrem",
      }),
    );
  });

  it("vinculoComposicaoSchema valida carreta_id", () => {
    const ok = vinculoComposicaoSchema.parse({ carreta_id: 10, ordem: 1 });
    assert.equal(ok.carreta_id, 10);
    assert.throws(() => vinculoComposicaoSchema.parse({ carreta_id: -1 }));
  });
});
