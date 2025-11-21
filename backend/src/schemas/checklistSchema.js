import { z } from "zod";

export const checklistSchema = z.object({
  caminhao_id: z.number().int().positive(),
  item_id: z.number().int().positive(),
  data_manutencao: z.string(),
  km_manutencao: z.number().positive(),
  valor: z.number().positive().optional().nullable(),
  observacao: z.string().optional().nullable(),
  oficina: z.string().optional().nullable(),
});

export const checklistUpdateSchema = checklistSchema.partial();
