import { z } from "zod";

export const pneuSchema = z.object({
  caminhao_id: z.number().int().positive(),
  posicao_id: z.number().int().positive(),
  status_id: z.number().int().positive(),
  data_instalacao: z.string(),
  km_instalacao: z.number().nonnegative().optional().nullable(),
  vida_util_km: z.number().positive().optional().nullable(),
  marca: z.string(),
  modelo: z.string(),
  medida: z.string().optional().nullable(),
  dot: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
});

export const pneuUpdateSchema = pneuSchema.partial();
