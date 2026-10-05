import { z } from "zod";

/**
 * Normaliza datas vindas do front / JSON round-trip de Date / dhEmi da NF-e.
 * Aceita YYYY-MM-DD, dd/MM/yyyy, ISO datetime (usa o prefixo de calendário) e Date.
 */
export function coerceDateOnlyString(value) {
  if (value == null || value === "") return value;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return value;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return value;
  const v = value.trim();
  if (!v) return v;
  if (/^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/.test(v)) return v;
  // ISO 8601 / datetime: "2026-08-05T10:00:00-03:00" → "2026-08-05"
  const isoPrefix = v.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/);
  if (isoPrefix) return isoPrefix[1];
  return v;
}

const dateOnlyMessage = "Use o formato de data YYYY-MM-DD ou dd/MM/yyyy.";

/** Schema de data-only; aceita também ISO datetime (coage para YYYY-MM-DD). */
export const dataStringSchema = z.preprocess(
  (value) => {
    // Deixa null/undefined passar para .nullable()/.optional() externos.
    if (value == null || value === "") return value;
    return coerceDateOnlyString(value);
  },
  z
    .string({
      invalid_type_error: dateOnlyMessage,
      required_error: dateOnlyMessage,
    })
    .regex(/^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/, dateOnlyMessage),
);
