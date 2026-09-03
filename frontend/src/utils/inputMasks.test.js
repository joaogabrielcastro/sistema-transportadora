import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  maskCpfInput,
  maskCnpjInput,
  maskCpfCnpjInput,
  maskPhoneInput,
  maskPlacaInput,
  maskChassiInput,
} from "./inputMasks.js";

describe("inputMasks", () => {
  it("maskCpfInput formata progressivamente", () => {
    assert.equal(maskCpfInput("123"), "123");
    assert.equal(maskCpfInput("12345678901"), "123.456.789-01");
  });

  it("maskCnpjInput formata progressivamente", () => {
    assert.equal(
      maskCnpjInput("12345678000195"),
      "12.345.678/0001-95",
    );
  });

  it("maskCpfCnpjInput escolhe CPF ou CNPJ", () => {
    assert.equal(maskCpfCnpjInput("12345678901"), "123.456.789-01");
    assert.equal(maskCpfCnpjInput("12345678000195"), "12.345.678/0001-95");
  });

  it("maskPhoneInput formata celular", () => {
    assert.equal(maskPhoneInput("41999998888"), "(41) 99999-8888");
  });

  it("maskPlacaInput limita a 7 chars", () => {
    assert.equal(maskPlacaInput("abc1d23x"), "ABC1D23");
  });

  it("maskChassiInput maiúsculo e limite", () => {
    assert.equal(maskChassiInput("abc123"), "ABC123");
  });
});
