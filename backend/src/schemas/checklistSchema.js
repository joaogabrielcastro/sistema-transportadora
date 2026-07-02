import { z } from "zod";
import { dataStringSchema } from "./shared.js";

export const checklistSchema = z.object({
  caminhao_id: z.coerce.number().int().positive().optional().nullable(),
  item_id: z.coerce.number().int().positive().optional().nullable(),
  data_manutencao: dataStringSchema,
  km_manutencao: z.coerce.number().int().positive().optional().nullable(),
  km_registro: z.coerce.number().int().positive().optional().nullable(),
  valor: z.coerce.number().nonnegative().optional().nullable(),
  observacao: z.string().optional().nullable(),
  oficina: z.string().optional().nullable(),
});

export const checklistUpdateSchema = checklistSchema.partial();
