import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeEmpresaFrota } from "../../src/utils/empresasFrota.js";

describe("normalizeEmpresaFrota", () => {
  it("mapeia nomes do SAT", () => {
    assert.equal(normalizeEmpresaFrota("SOLOFINO TRASNPORTADORA"), "Solofino");
    assert.equal(
      normalizeEmpresaFrota("TRANSMOTIN TRANSPORTES RODOVIÁRIOS LTDA"),
      "Transmotin",
    );
    assert.equal(normalizeEmpresaFrota("COLOMBOCAL"), "Colombocal");
    assert.equal(
      normalizeEmpresaFrota("COLOMBOCAL LTDA(PEDREIRA)"),
      "Colombocal",
    );
  });

  it("aceita valores canônicos e rejeita vazio", () => {
    assert.equal(normalizeEmpresaFrota("Solofino"), "Solofino");
    assert.equal(normalizeEmpresaFrota(""), null);
    assert.equal(normalizeEmpresaFrota(null), null);
    assert.equal(normalizeEmpresaFrota("Outra Coisa"), null);
  });
});
