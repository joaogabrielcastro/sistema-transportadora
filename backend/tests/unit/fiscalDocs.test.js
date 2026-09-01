import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  somenteDigitos,
  chaveAcessoValida,
  extrairModelo,
  gerarIdOperacaoCandidato,
  gerarIdOperacaoUnico,
} from "../../src/utils/fiscalDocs.js";

// Chave de acesso de teste com DV (dígito 44) recalculado pelo módulo 11.
function comDvValido(corpo43) {
  let peso = 2;
  let soma = 0;
  for (let i = corpo43.length - 1; i >= 0; i--) {
    soma += parseInt(corpo43.charAt(i), 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return `${corpo43}${dv}`;
}

describe("fiscalDocs", () => {
  it("somenteDigitos remove pontuação", () => {
    assert.equal(somenteDigitos("12.345.678/0001-99"), "12345678000199");
    assert.equal(somenteDigitos(null), "");
  });

  it("chaveAcessoValida aceita DV correto e rejeita errado", () => {
    const corpo = "3524061234567800019057001000001234123456789";
    assert.equal(corpo.length, 43);
    const valida = comDvValido(corpo);
    assert.equal(chaveAcessoValida(valida), true);

    const dvErrado = `${corpo}${(Number(valida.slice(-1)) + 1) % 10}`;
    assert.equal(chaveAcessoValida(dvErrado), false);
  });

  it("chaveAcessoValida rejeita comprimento != 44", () => {
    assert.equal(chaveAcessoValida("123"), false);
    assert.equal(chaveAcessoValida(""), false);
  });

  it("extrairModelo pega posições 21-22", () => {
    const chave = comDvValido(
      "3524061234567800019057001000001234123456789",
    );
    assert.equal(extrairModelo(chave), "57");
  });

  it("gerarIdOperacaoCandidato: 12 hex maiúsculos", () => {
    assert.match(gerarIdOperacaoCandidato(), /^[0-9A-F]{12}$/);
  });

  it("gerarIdOperacaoUnico faz retry quando candidato já existe", async () => {
    let chamadas = 0;
    const id = await gerarIdOperacaoUnico(async () => {
      chamadas += 1;
      return chamadas < 3; // colide nas 2 primeiras
    });
    assert.match(id, /^[0-9A-F]{12}$/);
    assert.equal(chamadas, 3);
  });

  it("gerarIdOperacaoUnico lança 503 após esgotar tentativas", async () => {
    await assert.rejects(
      () => gerarIdOperacaoUnico(async () => true, 4),
      (e) => e.statusCode === 503,
    );
  });
});
