import { z } from "zod";
import { FIELD_LIMITS } from "../utils/fieldLimits.js";

/** @param {unknown} value */
export function stripDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * String opcional: vazio → null, com trim e max.
 * @param {number} max
 * @param {{ min?: number }} [opts]
 */
export function optionalString(max, opts = {}) {
  const min = opts.min ?? 0;
  let schema = z.string().max(max, `Máximo ${max} caracteres.`);
  if (min > 0) {
    schema = schema.min(min, `Mínimo ${min} caracteres.`);
  }
  return z.preprocess((val) => {
    if (val === undefined) return undefined;
    if (val === null || val === "") return null;
    return String(val).trim();
  }, schema.nullable().optional());
}

/** @param {number} max */
export function requiredString(max, min = 1) {
  return z
    .string()
    .trim()
    .min(min, `Mínimo ${min} caracteres.`)
    .max(max, `Máximo ${max} caracteres.`);
}

/** Antigo ABC1234 ou Mercosul ABC1D23 */
const PLACA_REGEX =
  /^(?:[A-Z]{3}[0-9]{4}|[A-Z]{3}[0-9][A-Z0-9][0-9]{2})$/;

export const placaSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase().replace(/-/g, ""))
  .pipe(
    z
      .string()
      .min(7, "A placa deve ter 7 caracteres.")
      .max(FIELD_LIMITS.PLACA, `Placa: máximo ${FIELD_LIMITS.PLACA} caracteres.`)
      .regex(PLACA_REGEX, "Placa inválida (use formato Mercosul ou antigo)."),
  );

export const optionalPlacaSchema = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === null || String(val).trim() === "") return null;
  return String(val).trim();
}, placaSchema.nullable().optional());

export const cpfOptionalSchema = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === null || String(val).trim() === "") return null;
  return String(val).trim();
}, z
  .string()
  .max(FIELD_LIMITS.CPF_FORMATTED)
  .refine((v) => {
    const d = stripDigits(v);
    return d.length === 0 || d.length === FIELD_LIMITS.CPF_DIGITS;
  }, "CPF deve ter 11 dígitos.")
  .nullable()
  .optional());

export const cpfCnpjOptionalSchema = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === null || String(val).trim() === "") return null;
  return String(val).trim();
}, z
  .string()
  .max(FIELD_LIMITS.CNPJ_FORMATTED)
  .refine((v) => {
    const d = stripDigits(v);
    return (
      d.length === 0 ||
      d.length === FIELD_LIMITS.CPF_DIGITS ||
      d.length === FIELD_LIMITS.CNPJ_DIGITS
    );
  }, "Informe CPF (11 dígitos) ou CNPJ (14 dígitos).")
  .nullable()
  .optional());

export const phoneOptionalSchema = optionalString(FIELD_LIMITS.TELEFONE);

export const chassiOptionalSchema = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === null || String(val).trim() === "") return null;
  return String(val).trim().toUpperCase();
}, z
  .string()
  .max(FIELD_LIMITS.CHASSI)
  .regex(/^[A-HJ-NPR-Z0-9]*$/, "Chassi: use apenas letras e números (sem I, O, Q).")
  .nullable()
  .optional());

export const observacaoOptionalSchema = optionalString(FIELD_LIMITS.OBSERVACAO);
export const descricaoOptionalSchema = optionalString(FIELD_LIMITS.DESCRICAO);
export const oficinaOptionalSchema = optionalString(FIELD_LIMITS.OFICINA);

export const moneySchema = z.coerce
  .number()
  .nonnegative("Valor não pode ser negativo.")
  .max(FIELD_LIMITS.VALOR_MAX, "Valor acima do limite permitido.");

export const moneyOptionalSchema = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  moneySchema.nullable().optional(),
);

export const kmOptionalSchema = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce
    .number()
    .int()
    .nonnegative()
    .max(FIELD_LIMITS.KM_MAX)
    .nullable()
    .optional(),
);

export const anoOptionalSchema = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce
    .number()
    .int()
    .min(FIELD_LIMITS.ANO_MIN, `Ano mínimo: ${FIELD_LIMITS.ANO_MIN}.`)
    .max(new Date().getFullYear() + 1, "Ano inválido.")
    .nullable()
    .optional(),
);
