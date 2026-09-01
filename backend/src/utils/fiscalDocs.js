import crypto from "node:crypto";

/** Remove tudo que não for dígito (CNPJ/CPF, RNTRC, chave de acesso). */
export function somenteDigitos(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Valida o dígito verificador (módulo 11) de uma chave de acesso de 44 dígitos
 * de documento fiscal eletrônico (NF-e 55, CT-e 57, MDF-e 58).
 * Portado de ChaveAcessoUtil do jwsoft.
 * @param {string} chave
 * @returns {boolean}
 */
export function chaveAcessoValida(chave) {
  const c = somenteDigitos(chave);
  if (!/^\d{44}$/.test(c)) {
    return false;
  }
  const corpo = c.substring(0, 43);
  const dvInformado = parseInt(c.charAt(43), 10);

  let peso = 2;
  let soma = 0;
  for (let i = corpo.length - 1; i >= 0; i--) {
    soma += parseInt(corpo.charAt(i), 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dvCalculado = resto < 2 ? 0 : 11 - resto;
  return dvCalculado === dvInformado;
}

/** 2 primeiros dígitos = código IBGE da UF. */
export function extrairUf(chave) {
  return somenteDigitos(chave).substring(0, 2);
}

/** Posições 21-22 da chave: 55 = NF-e, 57 = CT-e, 58 = MDF-e. */
export function extrairModelo(chave) {
  return somenteDigitos(chave).substring(20, 22);
}

/**
 * Gera um IdOperacaoTransporte candidato (12 chars hex maiúsculos).
 * A unicidade global é conferida no service com retry (regra B17 da ANTT
 * exige unicidade por ano; a constraint no banco é global, mais estrita).
 */
export function gerarIdOperacaoCandidato() {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

/**
 * Gera um IdOperacaoTransporte único chamando `existe(candidato)` até achar
 * um livre. Lança após `maxTentativas`.
 * @param {(candidato: string) => Promise<boolean>} existe
 * @param {number} [maxTentativas]
 * @returns {Promise<string>}
 */
export async function gerarIdOperacaoUnico(existe, maxTentativas = 5) {
  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    const candidato = gerarIdOperacaoCandidato();
    if (!(await existe(candidato))) {
      return candidato;
    }
  }
  const err = new Error(
    `Não foi possível gerar um IdOperacaoTransporte único após ${maxTentativas} tentativas`,
  );
  err.statusCode = 503;
  throw err;
}
