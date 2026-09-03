import { z } from "zod";
import { FIELD_LIMITS } from "../utils/fieldLimits.js";
import { dataStringSchema } from "./shared.js";
import {
  kmOptionalSchema,
  observacaoOptionalSchema,
  optionalString,
} from "./fieldSchemas.js";

export const pneuSchema = z.object({
  caminhao_id: z.coerce.number().int().positive().optional().nullable(),
  posicao_id: z.coerce.number().int().positive().optional().nullable(),
  status_id: z.coerce.number().int().positive().optional().nullable(),
  data_instalacao: dataStringSchema.optional().nullable(),
  km_instalacao: kmOptionalSchema,
  vida_util_km: kmOptionalSchema,
  marca: optionalString(FIELD_LIMITS.MARCA, { min: 1 }),
  modelo: optionalString(FIELD_LIMITS.MODELO, { min: 1 }),
  observacao: observacaoOptionalSchema,
  stock_pneu_id: z.coerce.number().int().positive().optional(),
  consume_from_stock: z.coerce.boolean().optional(),
});

export const pneuCreateSchema = pneuSchema;

export const pneuUpdateSchema = pneuSchema.partial();

export const pneuCreateInStockSchema = z.object({
  caminhao_id: z.coerce.number().int().positive().optional().nullable(),
  posicao_id: z.coerce.number().int().positive().optional().nullable(),
  status_id: z.coerce.number().int().positive().optional().nullable(),
  data_instalacao: dataStringSchema.optional().nullable(),
  km_instalacao: kmOptionalSchema,
  vida_util_km: kmOptionalSchema,
  marca: optionalString(FIELD_LIMITS.MARCA, { min: 1 }),
  modelo: optionalString(FIELD_LIMITS.MODELO, { min: 1 }),
  observacao: observacaoOptionalSchema,
});
