import { z } from "zod";
import { FIELD_LIMITS } from "../utils/fieldLimits.js";
import { dataStringSchema } from "./shared.js";
import {
  kmOptionalSchema,
  moneyOptionalSchema,
  observacaoOptionalSchema,
  oficinaOptionalSchema,
  requiredString,
} from "./fieldSchemas.js";

const nomeItemSchema = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === null || String(val).trim() === "") return null;
  return String(val).trim();
}, requiredString(FIELD_LIMITS.NOME_ITEM).nullable().optional());

function parseDataParts(value) {
  const v = String(value || "").trim();
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) };
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return { y: Number(br[3]), m: Number(br[2]), d: Number(br[1]) };
  return null;
}

function isNotFutureDate(value) {
  const parts = parseDataParts(value);
  if (!parts) return false;
  const today = new Date();
  const todayNum =
    today.getFullYear() * 10000 +
    (today.getMonth() + 1) * 100 +
    today.getDate();
  const valueNum = parts.y * 10000 + parts.m * 100 + parts.d;
  return valueNum <= todayNum;
}

export const checklistSchema = z.object({
  caminhao_id: z.coerce.number().int().positive().optional().nullable(),
  item_id: z.coerce.number().int().positive().optional().nullable(),
  nome_item: nomeItemSchema,
  data_manutencao: dataStringSchema.refine(isNotFutureDate, {
    message: "A data da manutenção não pode ser futura.",
  }),
  km_manutencao: kmOptionalSchema,
  km_registro: kmOptionalSchema,
  valor: moneyOptionalSchema,
  observacao: observacaoOptionalSchema,
  oficina: oficinaOptionalSchema,
  proxima_km: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.coerce.number().int().positive().max(FIELD_LIMITS.KM_MAX).optional().nullable(),
  ),
  proxima_data: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    dataStringSchema.optional().nullable(),
  ),
  produto_id: z.coerce.number().int().positive().optional().nullable(),
  quantidade_estoque: z.coerce.number().positive().optional().nullable(),
});

export const checklistUpdateSchema = checklistSchema.partial();
