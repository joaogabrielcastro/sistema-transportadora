import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatCurrency,
  formatNumber,
  formatPlaca,
  formatCPF,
  formatCNPJ,
  formatPhone,
  formatKm,
  formatLiters,
  capitalizeWords,
  truncateText,
  formatFileSize,
} from "./formatters.js";

test("formatCurrency e formatNumber tratam nulos", () => {
  assert.equal(formatCurrency(null), "R$ 0,00");
  assert.match(formatCurrency(10.5), /R\$/);
  assert.equal(formatNumber(null), "0");
  assert.equal(formatNumber(1500), "1.500");
});

test("formatPlaca mercosul e antigo", () => {
  assert.equal(formatPlaca("abc1d23"), "ABC1D23");
  assert.equal(formatPlaca("ABC1234"), "ABC-1234");
  assert.equal(formatPlaca(""), "");
});

test("formatCPF CNPJ e telefone", () => {
  assert.equal(formatCPF("12345678901"), "123.456.789-01");
  assert.equal(formatCNPJ("12345678000199"), "12.345.678/0001-99");
  assert.equal(formatPhone("11987654321"), "(11) 98765-4321");
  assert.equal(formatPhone("1133334444"), "(11) 3333-4444");
});

test("formatKm liters capitalize truncate fileSize", () => {
  assert.equal(formatKm(null), "0 km");
  assert.match(formatKm(1000), /km$/);
  assert.equal(formatLiters(null), "0 L");
  assert.equal(capitalizeWords("joão silva"), "João Silva");
  assert.equal(truncateText("abcdef", 3), "abc...");
  assert.equal(truncateText("ab", 5), "ab");
  assert.equal(formatFileSize(0), "0 Bytes");
  assert.match(formatFileSize(2048), /KB/);
});
