import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decimalsFromStep,
  parseNumberInputValue,
  formatNumberInputDisplay,
} from "./numberInput.js";

describe("decimalsFromStep", () => {
  it("inteiro quando step ausente ou inteiro", () => {
    assert.equal(decimalsFromStep(undefined), null);
    assert.equal(decimalsFromStep("1"), null);
    assert.equal(decimalsFromStep(1), null);
  });

  it("detecta casas a partir do step", () => {
    assert.equal(decimalsFromStep("0.01"), 2);
    assert.equal(decimalsFromStep("0.001"), 3);
    assert.equal(decimalsFromStep("any"), 6);
  });
});

describe("parseNumberInputValue", () => {
  it("inteiros com pontuação BR", () => {
    assert.equal(parseNumberInputValue("598.245"), "598245");
    assert.equal(parseNumberInputValue("1.234.567"), "1234567");
    assert.equal(parseNumberInputValue("598245"), "598245");
  });

  it("decimais com vírgula", () => {
    assert.equal(
      parseNumberInputValue("1.234,56", { maxDecimals: 2 }),
      "1234.56",
    );
    assert.equal(parseNumberInputValue("10,5", { maxDecimals: 2 }), "10.5");
    assert.equal(parseNumberInputValue("10,", { maxDecimals: 2 }), "10.");
  });

  it("vazio", () => {
    assert.equal(parseNumberInputValue(""), "");
    assert.equal(parseNumberInputValue("abc"), "");
  });
});

describe("formatNumberInputDisplay", () => {
  it("formata inteiros", () => {
    assert.equal(formatNumberInputDisplay(598245), "598.245");
    assert.equal(formatNumberInputDisplay("1000"), "1.000");
    assert.equal(formatNumberInputDisplay(""), "");
  });

  it("formata decimais", () => {
    assert.equal(
      formatNumberInputDisplay("1234.56", { maxDecimals: 2 }),
      "1.234,56",
    );
    assert.equal(
      formatNumberInputDisplay("10.", { maxDecimals: 2 }),
      "10,",
    );
  });

  it("useGrouping: false desliga o separador de milhar (default inalterado)", () => {
    assert.equal(
      formatNumberInputDisplay("1000000", { useGrouping: false }),
      "1000000",
    );
    assert.equal(
      formatNumberInputDisplay("1234567.89", {
        maxDecimals: 2,
        useGrouping: false,
      }),
      "1234567,89",
    );
    // sem a flag continua agrupando como antes
    assert.equal(formatNumberInputDisplay("1000000"), "1.000.000");
  });
});

describe("regressão: 'trava em 1,00' ao digitar valor grande (display -> reparse)", () => {
  // Reproduz a digitação real: o input mostra o DISPLAY e o usuário acrescenta
  // um caractere no fim a cada tecla. Com milhar aceso, o "." do display era
  // relido como decimal e o campo travava. Com useGrouping:false, não.
  const digitar = (keys, { maxDecimals, useGrouping }) => {
    let state = "";
    for (const k of keys) {
      const display = formatNumberInputDisplay(state, { maxDecimals, useGrouping });
      state = parseNumberInputValue(display + k, { maxDecimals });
    }
    return state;
  };

  it("com milhar (comportamento antigo) trava", () => {
    assert.equal(digitar("150000000".split(""), { maxDecimals: 2 }), "1.50");
  });

  it("com useGrouping:false o valor é digitado por inteiro", () => {
    assert.equal(
      digitar("150000000".split(""), { maxDecimals: 2, useGrouping: false }),
      "150000000",
    );
    assert.equal(
      digitar("1234567,89".split(""), { maxDecimals: 2, useGrouping: false }),
      "1234567.89",
    );
  });
});
