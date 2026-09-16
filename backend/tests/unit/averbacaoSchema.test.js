import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { salvarSeguroConfigSchema, solicitarAverbacaoSchema } from "../../src/schemas/averbacaoSchema.js";

describe("averbacaoSchema", () => {
  it("aceita configuração válida de homologação", () => {
    const dto = salvarSeguroConfigSchema.parse({
      provider: "atm",
      ambiente: "homologacao",
      automatico: true,
      ativo: true,
      codigo_atm: "11000000",
      usuario: "teste",
      senha: "teste",
      seguradora: "Porto",
      numero_apolice: "123",
    });
    assert.equal(dto.ambiente, "homologacao");
    assert.equal(dto.provider, "atm");
  });

  it("rejeita configuração inválida (provedor/ambiente)", () => {
    assert.throws(() =>
      salvarSeguroConfigSchema.parse({ provider: "ndd", ambiente: "homologacao" }),
    );
    assert.throws(() =>
      salvarSeguroConfigSchema.parse({ provider: "atm", ambiente: "sandbox" }),
    );
  });

  it("solicitar exige exatamente um documento", () => {
    const cte = solicitarAverbacaoSchema.parse({ cte_id: 10 });
    assert.equal(cte.cte_id, 10);
    assert.throws(() => solicitarAverbacaoSchema.parse({}));
    assert.throws(() => solicitarAverbacaoSchema.parse({ cte_id: 1, mdfe_id: 2 }));
  });

  it("senha vazia não apaga a existente (null/omit)", () => {
    const dto = salvarSeguroConfigSchema.parse({
      provider: "atm",
      ambiente: "producao",
      senha: "",
    });
    assert.equal(dto.senha, null);
  });
});
