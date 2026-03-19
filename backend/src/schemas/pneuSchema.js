import { z } from "zod";

const dataStringSchema = z
  .string()
  .regex(
    /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/,
    "Use o formato de data YYYY-MM-DD ou dd/MM/yyyy.",
  );

export const pneuSchema = z.object({
  caminhao_id: z.number().int().positive().optional().nullable(),
  posicao_id: z.number().int().positive().optional().nullable(),
  status_id: z.number().int().positive().optional().nullable(),
  data_instalacao: dataStringSchema.optional().nullable(),
  km_instalacao: z.number().int().nonnegative().optional().nullable(),
  vida_util_km: z.number().int().nonnegative().optional().nullable(),
  marca: z.string().min(1).optional().nullable(),
  modelo: z.string().min(1).optional().nullable(),
  observacao: z.string().optional().nullable(),
});

export const pneuUpdateSchema = pneuSchema.partial();

export const pneuCreateInStockSchema = z.object({
  caminhao_id: z.number().int().positive().optional().nullable(),
  posicao_id: z.number().int().positive().optional().nullable(),
  status_id: z.number().int().positive().optional().nullable(),
  data_instalacao: dataStringSchema.optional().nullable(),
  km_instalacao: z.number().int().nonnegative().optional().nullable(),
  vida_util_km: z.number().int().nonnegative().optional().nullable(),
  marca: z.string().min(1).optional().nullable(),
  modelo: z.string().min(1).optional().nullable(),
  observacao: z.string().optional().nullable(),
});
