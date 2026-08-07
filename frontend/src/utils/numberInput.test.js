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
});
