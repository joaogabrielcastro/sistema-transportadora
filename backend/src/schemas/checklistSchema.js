import { z } from "zod";

const dataStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato de data YYYY-MM-DD.");

export const checklistSchema = z.object({
  caminhao_id: z.number().int().positive().optional().nullable(),
  item_id: z.number().int().positive().optional().nullable(),
  data_manutencao: dataStringSchema,
  km_manutencao: z.number().int().positive().optional().nullable(),
  km_registro: z.number().int().positive().optional().nullable(),
  valor: z.number().nonnegative().optional().nullable(),
  observacao: z.string().optional().nullable(),
  oficina: z.string().optional().nullable(),
});

export const checklistUpdateSchema = checklistSchema.partial();
