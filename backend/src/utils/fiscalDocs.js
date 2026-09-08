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

/** Posições 21-22 da chave: 55 = NF-e, 57 = CT-e, 58 = MDF-e. */
export function extrairModelo(chave) {
  const c = somenteDigitos(chave);
  if (c.length < 22) return null;
  return c.substring(20, 22);
}

export function dvModulo11Base(algarismos, pesos) {
  let soma = 0;
  for (let i = 0; i < algarismos.length; i++) {
    soma += Number(algarismos[i]) * pesos[i];
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv;
}

/** CPF com dígitos verificadores (Receita). */
export function cpfValido(value) {
  const c = somenteDigitos(value);
  if (!/^\d{11}$/.test(c)) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  const dv1 = dvModulo11Base(c.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = dvModulo11Base(c.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv1 === Number(c[9]) && dv2 === Number(c[10]);
}

/** CNPJ com dígitos verificadores (Receita). */
export function cnpjValido(value) {
  const c = somenteDigitos(value);
  if (!/^\d{14}$/.test(c)) return false;
  if (/^(\d)\1{13}$/.test(c)) return false;
  const dv1 = dvModulo11Base(
    c.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  const dv2 = dvModulo11Base(
    c.slice(0, 13),
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return dv1 === Number(c[12]) && dv2 === Number(c[13]);
}

export function cpfCnpjValido(value) {
  const c = somenteDigitos(value);
  if (c.length === 11) return cpfValido(c);
  if (c.length === 14) return cnpjValido(c);
  return false;
}

export const UFS_BRASIL = Object.freeze([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export function ufValida(uf) {
  return UFS_BRASIL.includes(String(uf || "").toUpperCase());
}

/**
 * IE: ISENTO/vazio ok; senão só dígitos 2–14. Dígito verificador varia por UF
 * (PENDÊNCIA EXTERNA para regras estaduais completas).
 */
export function inscricaoEstadualValida(ie, uf) {
  if (ie == null || String(ie).trim() === "") return true;
  const raw = String(ie).trim().toUpperCase();
  if (raw === "ISENTO") return true;
  const d = somenteDigitos(raw);
  if (d.length < 2 || d.length > 14) return false;
  if (uf && !ufValida(uf)) return false;
  return true;
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
 * Decide se a operação de transporte exige registro de CIOT (item 3.1).
 *
 * Critério antigo (preservado): a contratação de transportador terceiro — TAC
 * (autônomo) ou outra ETC — para o transporte rodoviário remunerado de cargas
 * exige o registro da operação.
 *
 * Critério novo (a partir de set/2026, adicionado sem reescrever o antigo): o
 * registro passou a ser exigido também quando o transporte é feito com frota
 * própria, desde que seja transporte remunerado de carga de terceiros. Carga
 * própria continua dispensada.
 *
 * Função pura — não dispara bloqueio em nenhum fluxo de emissão; fica
 * disponível para quem precisar consultar a regra.
 *
 * @param {{ contratadoEhTerceiro?: boolean, cargaPropria?: boolean }} [params]
 * @returns {{ obrigatorio: boolean, motivo: string }}
 */
export function ciotObrigatorio({
  contratadoEhTerceiro = false,
  cargaPropria = false,
} = {}) {
  if (contratadoEhTerceiro) {
    return {
      obrigatorio: true,
      motivo:
        "Contratação de transportador terceiro (TAC/ETC) no transporte " +
        "rodoviário remunerado de cargas.",
    };
  }
  if (!cargaPropria) {
    return {
      obrigatorio: true,
      motivo:
        "Transporte rodoviário remunerado de carga de terceiros com frota " +
        "própria (critério vigente a partir de set/2026).",
    };
  }
  return {
    obrigatorio: false,
    motivo: "Transporte de carga própria — operação dispensada de CIOT.",
  };
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
