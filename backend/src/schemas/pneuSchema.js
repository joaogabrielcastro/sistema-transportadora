import { z } from "zod";
import { dataStringSchema } from "./shared.js";

export const pneuSchema = z.object({
  caminhao_id: z.coerce.number().int().positive().optional().nullable(),
  posicao_id: z.coerce.number().int().positive().optional().nullable(),
  status_id: z.coerce.number().int().positive().optional().nullable(),
  data_instalacao: dataStringSchema.optional().nullable(),
  km_instalacao: z.coerce.number().int().nonnegative().optional().nullable(),
  vida_util_km: z.coerce.number().int().nonnegative().optional().nullable(),
  marca: z.string().min(1).optional().nullable(),
  modelo: z.string().min(1).optional().nullable(),
  observacao: z.string().optional().nullable(),
});

export const pneuUpdateSchema = pneuSchema.partial();

export const pneuCreateInStockSchema = z.object({
  caminhao_id: z.coerce.number().int().positive().optional().nullable(),
  posicao_id: z.coerce.number().int().positive().optional().nullable(),
  status_id: z.coerce.number().int().positive().optional().nullable(),
  data_instalacao: dataStringSchema.optional().nullable(),
  km_instalacao: z.coerce.number().int().nonnegative().optional().nullable(),
  vida_util_km: z.coerce.number().int().nonnegative().optional().nullable(),
  marca: z.string().min(1).optional().nullable(),
  modelo: z.string().min(1).optional().nullable(),
  observacao: z.string().optional().nullable(),
});
