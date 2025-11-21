import { z } from "zod";

export const gastoSchema = z.object({
  caminhao_id: z.number().int().positive(),
  tipo_gasto_id: z.number().int().positive(),
  data_gasto: z.string(),
  valor: z.number().positive(),
  descricao: z.string().optional().nullable(),
  km_registro: z.number().positive().optional().nullable(),
  quantidade_combustivel: z.number().positive().optional().nullable(),
});

export const gastoUpdateSchema = gastoSchema.partial();
