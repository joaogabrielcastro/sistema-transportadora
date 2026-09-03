// frontend/src/utils/fiscalFieldMask.js
//
// Lógica pura de máscara / normalização / trava dos campos fiscais de transporte
// (CT-e / MDF-e). Os componentes em `components/fiscal/FiscalFields.jsx`
// (CpfCnpjField, MoneyField, PercentField, UfField) são só invólucros finos em
// volta destas funções — assim o comportamento fica testável sem biblioteca de
// componentes (o front só tem o runner do Node, cobrindo `src/utils/**`).
//
// Regra de ouro: o valor guardado no estado / enviado no payload é sempre CRU
// (só dígitos para CPF/CNPJ, número puro para monetário/percentual, sigla
// maiúscula para UF). A pontuação existe só na exibição.

/** Remove tudo que não for dígito. */
export function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * CPF/CNPJ: mantém só dígitos e corta no limite — nunca deixa passar de 14
 * (ou de 11 quando `maxDigits` é 11, para campos que só aceitam CPF).
 * @param {string|number|null|undefined} value
 * @param {11|14} [maxDigits=14]
 * @returns {string} só dígitos, no máximo `maxDigits` caracteres
 */
export function clampCpfCnpjDigits(value, maxDigits = 14) {
  const cap = maxDigits === 11 ? 11 : 14;
  return onlyDigits(value).slice(0, cap);
}

/**
 * Máscara visual de CPF (até 11 dígitos, `000.000.000-00`) ou CNPJ
 * (12 a 14 dígitos, `00.000.000/0000-00`). Não altera o valor guardado.
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
export function formatCpfCnpj(value) {
  const d = clampCpfCnpjDigits(value);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

/**
 * Máscara visual SEMPRE de CNPJ (`00.000.000/0000-00`), qualquer que seja o
 * número de dígitos. Para campos que só aceitam CNPJ (ex.: CNPJ da seguradora
 * do MDF-e) e não devem alternar para o formato de CPF quando têm poucos
 * dígitos. Não altera o valor guardado.
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
export function formatCnpj(value) {
  const d = clampCpfCnpjDigits(value, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

/**
 * Remove dígitos (mantém letras, espaço, acento e pontuação). Para campos de
 * nome / razão social / nome de município que não devem aceitar número.
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
export function semDigitos(value) {
  return String(value ?? "").replace(/\d/g, "");
}

/**
 * Validação leve de formato de e-mail para feedback na hora da digitação
 * (o backend continua sendo a validação forte, via `z.string().email()`).
 * @param {string|number|null|undefined} value
 * @returns {boolean} `true` para vazio ou formato plausível de e-mail
 */
export function emailBasicoValido(value) {
  const s = String(value ?? "").trim();
  if (!s) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * `true` só quando o CPF/CNPJ tem EXATAMENTE 11 (CPF) ou 14 (CNPJ) dígitos —
 * nunca "até 14". Mesma regra do backend (`fiscalSchema.js`).
 * @param {string|number|null|undefined} value
 * @returns {boolean}
 */
export function cpfCnpjCompleto(value) {
  const n = onlyDigits(value).length;
  return n === 11 || n === 14;
}

/**
 * UF: só letras, exatamente 2, maiúsculas. Corta o excedente.
 * @param {string|number|null|undefined} value
 * @returns {string} 0 a 2 letras maiúsculas
 */
export function formatUf(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Maior valor que uma coluna `DECIMAL(precisao, escala)` aguenta sem estourar.
 * Ex.: `DECIMAL(14,2)` → 12 dígitos inteiros → 999999999999.99.
 * @param {number} intDigits quantidade de dígitos inteiros permitidos
 * @param {number} [decimals=2]
 * @returns {number}
 */
export function decimalCeiling(intDigits, decimals = 2) {
  if (!Number.isFinite(intDigits) || intDigits <= 0) return Infinity;
  const int = "9".repeat(intDigits);
  const frac = decimals > 0 ? "." + "9".repeat(decimals) : "";
  return Number(int + frac);
}

// Teto dos monetários fiscais: as colunas são `DECIMAL(14,2)` (12 dígitos
// inteiros). Peso do MDF-e é `DECIMAL(14,3)` (11 dígitos inteiros). A quantidade
// do grupo infQ do CT-e é `fiscal_cte_carga_quantidades.quantidade DECIMAL(15,4)`
// (11 dígitos inteiros, 4 decimais) — teto folgado para kg / litro / m³ /
// unidades e ainda assim barra valor que estouraria a coluna.
export const MONEY_CEILING_14_2 = decimalCeiling(12, 2); // 999999999999.99
export const WEIGHT_CEILING_14_3 = decimalCeiling(11, 3); // 99999999999.999
export const QTY_CEILING_15_4 = decimalCeiling(11, 4); // 99999999999.9999

/**
 * Aplica piso / teto / limite de casas decimais a uma string numérica "crua"
 * (a que o `FormField type="number"` já emite no onChange). Continua CRUA —
 * não formata pontuação. Um valor abaixo do piso vira o piso; acima do teto,
 * o teto; dígitos decimais além de `maxDecimals` são cortados.
 * @param {string|number|null|undefined} raw
 * @param {{ min?: number, max?: number, maxDecimals?: number }} [opts]
 * @returns {string}
 */
export function clampNumericRaw(raw, opts = {}) {
  const { min, max, maxDecimals } = opts;
  if (raw === "" || raw == null) return "";
  const s = String(raw).trim();
  if (s === "" || s === "-" || s === "." || s === "-.") return s;

  const neg = s.startsWith("-");
  const [intPartRaw = "", fracPartRaw = ""] = s.replace("-", "").split(".");
  const intPart = intPartRaw.replace(/\D/g, "");
  let fracPart = fracPartRaw.replace(/\D/g, "");
  if (typeof maxDecimals === "number" && maxDecimals >= 0) {
    fracPart = fracPart.slice(0, maxDecimals);
  }

  const hadDot = s.includes(".");
  let out = (neg ? "-" : "") + (intPart || (hadDot ? "0" : ""));
  if (hadDot) out += "." + fracPart;

  const n = Number(out);
  if (!Number.isFinite(n)) return neg ? "-" : "";
  if (typeof max === "number" && n > max) return String(max);
  if (typeof min === "number" && n < min) return String(min);
  return out;
}

/** Trava de campo monetário: sem negativo, teto da coluna, 2 casas. */
export function clampMoneyRaw(raw, ceiling = MONEY_CEILING_14_2) {
  return clampNumericRaw(raw, { min: 0, max: ceiling, maxDecimals: 2 });
}

/** Trava de percentual: 0 a 100, 2 casas, sem negativo. */
export function clampPercentRaw(raw) {
  return clampNumericRaw(raw, { min: 0, max: 100, maxDecimals: 2 });
}

/**
 * Normalização "durante a digitação": só arruma caracteres e corta casas
 * decimais além do limite. NÃO aplica piso/teto.
 *
 * Clampar mínimo/máximo a cada tecla, sobre um número ainda PARCIAL, faz o
 * campo "pular" para o limite antes do usuário terminar de digitar (ex.: um
 * percentual virava 100 ao 3º dígito, um monetário parava no 1º). O piso/teto
 * é aplicado no blur pelo próprio `FormField` (props `min`/`max`), igual ao
 * `type="number"` que o resto do sistema usa.
 * @param {string|number|null|undefined} raw
 * @param {number} [maxDecimals]
 * @returns {string}
 */
export function normalizeNumericRaw(raw, maxDecimals) {
  return clampNumericRaw(raw, { maxDecimals });
}

/** Normalização de monetário na digitação: 2 casas, sem clamp de faixa. */
export function normalizeMoneyRaw(raw) {
  return normalizeNumericRaw(raw, 2);
}

/** Normalização de percentual na digitação: 2 casas, sem clamp de faixa. */
export function normalizePercentRaw(raw) {
  return normalizeNumericRaw(raw, 2);
}
