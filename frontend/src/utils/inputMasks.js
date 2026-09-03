import { FIELD_LIMITS } from "./fieldLimits.js";

/** @param {unknown} value */
export function stripDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/** Máscara CPF progressiva: 000.000.000-00 */
export function maskCpfInput(value) {
  const d = stripDigits(value).slice(0, FIELD_LIMITS.CPF_DIGITS);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara CNPJ progressiva: 00.000.000/0000-00 */
export function maskCnpjInput(value) {
  const d = stripDigits(value).slice(0, FIELD_LIMITS.CNPJ_DIGITS);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** CPF ou CNPJ conforme quantidade de dígitos. */
export function maskCpfCnpjInput(value) {
  const d = stripDigits(value);
  if (d.length <= FIELD_LIMITS.CPF_DIGITS) return maskCpfInput(value);
  return maskCnpjInput(value);
}

/** Telefone BR: (00) 0000-0000 ou (00) 00000-0000 */
export function maskPhoneInput(value) {
  const d = stripDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Placa Mercosul/antiga — até 7 caracteres alfanuméricos. */
export function maskPlacaInput(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, FIELD_LIMITS.PLACA_INPUT);
}

/** Somente dígitos, com limite. */
export function maskDigitsInput(value, maxDigits) {
  return stripDigits(value).slice(0, maxDigits);
}

/** Chassi / VIN — alfanumérico maiúsculo. */
export function maskChassiInput(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, FIELD_LIMITS.CHASSI);
}

/** Categoria CNH — letras, até 2. */
export function maskCnhCategoriaInput(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, FIELD_LIMITS.CNH_CATEGORIA);
}

/** Nome de pessoa — letras e espaços. */
export function maskPersonNameInput(value, maxLen = FIELD_LIMITS.NOME) {
  return String(value ?? "")
    .replace(/[^a-zA-ZÀ-ÿ\s]/g, "")
    .slice(0, maxLen);
}

/** @type {Record<string, (value: string) => string>} */
export const INPUT_MASKS = Object.freeze({
  cpf: maskCpfInput,
  cnpj: maskCnpjInput,
  cpfCnpj: maskCpfCnpjInput,
  phone: maskPhoneInput,
  placa: maskPlacaInput,
  chaveNfe: (v) => maskDigitsInput(v, FIELD_LIMITS.CHAVE_ACESSO),
  cnh: (v) => maskDigitsInput(v, 11),
  cnhCategoria: maskCnhCategoriaInput,
  chassi: maskChassiInput,
  digits: (v) => maskDigitsInput(v, 20),
});

/** @param {string | undefined} mask */
export function applyInputMask(mask, value) {
  if (!mask || !INPUT_MASKS[mask]) return value;
  return INPUT_MASKS[mask](value);
}

/** @param {string | undefined} mask */
export function maxLengthForMask(mask) {
  switch (mask) {
    case "cpf":
      return FIELD_LIMITS.CPF_FORMATTED;
    case "cnpj":
      return FIELD_LIMITS.CNPJ_FORMATTED;
    case "cpfCnpj":
      return FIELD_LIMITS.CNPJ_FORMATTED;
    case "phone":
      return FIELD_LIMITS.TELEFONE;
    case "placa":
      return FIELD_LIMITS.PLACA_INPUT;
    case "chaveNfe":
      return FIELD_LIMITS.CHAVE_ACESSO;
    case "cnh":
      return 11;
    case "cnhCategoria":
      return FIELD_LIMITS.CNH_CATEGORIA;
    case "chassi":
      return FIELD_LIMITS.CHASSI;
    default:
      return undefined;
  }
}

/**
 * Helper para handlers de formulário.
 * @param {string} field
 * @param {string} rawValue
 * @param {{ mask?: string, maxLength?: number }} [opts]
 */
export function sanitizeFieldValue(rawValue, opts = {}) {
  let value = rawValue;
  if (opts.mask) {
    value = applyInputMask(opts.mask, value);
  }
  const cap = opts.maxLength ?? (opts.mask ? maxLengthForMask(opts.mask) : undefined);
  if (cap != null && value.length > cap) {
    value = value.slice(0, cap);
  }
  return value;
}
