import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  onlyDigits,
  clampCpfCnpjDigits,
  formatCpfCnpj,
  formatCnpj,
  cpfCnpjCompleto,
  formatUf,
  semDigitos,
  emailBasicoValido,
  decimalCeiling,
  clampNumericRaw,
  clampMoneyRaw,
  clampPercentRaw,
  normalizeMoneyRaw,
  normalizePercentRaw,
  MONEY_CEILING_14_2,
  WEIGHT_CEILING_14_3,
  QTY_CEILING_15_4,
} from "./fiscalFieldMask.js";

describe("onlyDigits", () => {
  it("remove pontuação e letras", () => {
    assert.equal(onlyDigits("12.345.678/0001-99"), "12345678000199");
    assert.equal(onlyDigits("abc"), "");
    assert.equal(onlyDigits(null), "");
  });
});

describe("clampCpfCnpjDigits", () => {
  it("corta o dígito além de 14 (CNPJ)", () => {
    assert.equal(clampCpfCnpjDigits("123456789012345678"), "12345678901234");
    assert.equal(clampCpfCnpjDigits("12.345.678/0001-99"), "12345678000199");
  });

  it("corta em 11 quando maxDigits é 11 (campo só CPF)", () => {
    assert.equal(clampCpfCnpjDigits("12345678901234", 11), "12345678901");
  });
});

describe("formatCpfCnpj", () => {
  it("máscara de CPF até 11 dígitos", () => {
    assert.equal(formatCpfCnpj("12345678901"), "123.456.789-01");
    assert.equal(formatCpfCnpj("123456"), "123.456");
  });

  it("máscara de CNPJ de 12 a 14 dígitos", () => {
    assert.equal(formatCpfCnpj("12345678000199"), "12.345.678/0001-99");
    assert.equal(formatCpfCnpj("123456789012"), "12.345.678/9012");
  });

  it("ignora dígito excedente na exibição", () => {
    assert.equal(formatCpfCnpj("123456780001990000"), "12.345.678/0001-99");
  });
});

describe("cpfCnpjCompleto", () => {
  it("só 11 ou 14 dígitos exatos", () => {
    assert.equal(cpfCnpjCompleto("12345678901"), true);
    assert.equal(cpfCnpjCompleto("12345678000199"), true);
    assert.equal(cpfCnpjCompleto("123456789012"), false); // 12
    assert.equal(cpfCnpjCompleto("1234567890"), false); // 10
    assert.equal(cpfCnpjCompleto(""), false);
  });
});

describe("formatUf", () => {
  it("só letras, 2, maiúsculas", () => {
    assert.equal(formatUf("sp"), "SP");
    assert.equal(formatUf("s1p2a"), "SP");
    assert.equal(formatUf("minas"), "MI");
    assert.equal(formatUf(""), "");
  });
});

describe("decimalCeiling", () => {
  it("teto de DECIMAL(precisao, escala)", () => {
    assert.equal(decimalCeiling(12, 2), 999999999999.99);
    assert.equal(decimalCeiling(11, 3), 99999999999.999);
    assert.equal(MONEY_CEILING_14_2, 999999999999.99);
    assert.equal(WEIGHT_CEILING_14_3, 99999999999.999);
  });
});

describe("clampNumericRaw", () => {
  it("mantém valor cru dentro dos limites", () => {
    assert.equal(clampNumericRaw("1234.56", { min: 0, max: 1e6, maxDecimals: 2 }), "1234.56");
  });

  it("corta casas decimais além do limite", () => {
    assert.equal(clampNumericRaw("10.12999", { maxDecimals: 2 }), "10.12");
  });

  it("aplica teto", () => {
    assert.equal(
      clampNumericRaw("9999999999999", { min: 0, max: MONEY_CEILING_14_2, maxDecimals: 2 }),
      "999999999999.99",
    );
  });

  it("aplica piso (sem negativo)", () => {
    assert.equal(clampNumericRaw("-5", { min: 0, maxDecimals: 2 }), "0");
  });

  it("passa vazio / parciais adiante", () => {
    assert.equal(clampNumericRaw("", {}), "");
    assert.equal(clampNumericRaw("-", {}), "-");
    assert.equal(clampNumericRaw("10.", { maxDecimals: 2 }), "10.");
  });
});

describe("clampMoneyRaw", () => {
  it("sem negativo, teto DECIMAL(14,2), 2 casas", () => {
    assert.equal(clampMoneyRaw("-1"), "0");
    assert.equal(clampMoneyRaw("12.999"), "12.99");
    assert.equal(clampMoneyRaw("1000000000000000"), "999999999999.99");
    assert.equal(clampMoneyRaw("1234.5"), "1234.5");
  });
});

describe("clampPercentRaw", () => {
  it("trava 0 a 100 com 2 casas", () => {
    assert.equal(clampPercentRaw("150"), "100");
    assert.equal(clampPercentRaw("-3"), "0");
    assert.equal(clampPercentRaw("12.349"), "12.34");
    assert.equal(clampPercentRaw("100"), "100");
  });
});

describe("normalizeMoneyRaw / normalizePercentRaw (digitação — sem clamp de faixa)", () => {
  it("NÃO puxa o valor para dentro do intervalo no meio da digitação", () => {
    // Este é o bug da rodada 2: o clamp por tecla fazia o percentual virar 100
    // ao 3º dígito e o monetário parar cedo. A normalização de digitação
    // preserva o número parcial; o piso/teto é do blur (FormField min/max).
    assert.equal(normalizePercentRaw("250"), "250");
    assert.equal(normalizePercentRaw("999"), "999");
    assert.equal(normalizeMoneyRaw("150000000"), "150000000");
    assert.equal(normalizeMoneyRaw("1000000000000000"), "1000000000000000");
  });

  it("ainda normaliza caracteres e corta casas decimais", () => {
    assert.equal(normalizeMoneyRaw("12.999"), "12.99");
    assert.equal(normalizePercentRaw("33,339".replace(",", ".")), "33.33");
    assert.equal(normalizeMoneyRaw(""), "");
    assert.equal(normalizeMoneyRaw("10."), "10.");
  });
});

describe("formatCnpj", () => {
  it("máscara SEMPRE de CNPJ, não alterna para CPF", () => {
    assert.equal(formatCnpj("12345678000199"), "12.345.678/0001-99");
    // poucos dígitos: continua no formato de CNPJ (não vira 000.000.000-00)
    assert.equal(formatCnpj("12345678901"), "12.345.678/901");
    assert.equal(formatCnpj("123"), "12.3");
    assert.equal(formatCnpj("123456780001990000"), "12.345.678/0001-99");
  });
});

describe("semDigitos", () => {
  it("remove números, mantém letras / espaço / acento / pontuação", () => {
    assert.equal(semDigitos("Transportes 123 Ltda."), "Transportes  Ltda.");
    assert.equal(semDigitos("São João do Sul"), "São João do Sul");
    assert.equal(semDigitos(null), "");
  });
});

describe("emailBasicoValido", () => {
  it("vazio é válido; formato plausível é válido; sem arroba/ponto não", () => {
    assert.equal(emailBasicoValido(""), true);
    assert.equal(emailBasicoValido("  "), true);
    assert.equal(emailBasicoValido("contato@empresa.com.br"), true);
    assert.equal(emailBasicoValido("sem-arroba"), false);
    assert.equal(emailBasicoValido("a@b"), false);
    assert.equal(emailBasicoValido("a b@c.com"), false);
  });
});

describe("QTY_CEILING_15_4", () => {
  it("teto da coluna DECIMAL(15,4) do grupo infQ", () => {
    assert.equal(QTY_CEILING_15_4, 99999999999.9999);
  });
});
