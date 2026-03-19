import { z } from "zod";

const dataStringSchema = z
  .string()
  .regex(
    /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/,
    "Use o formato de data YYYY-MM-DD ou dd/MM/yyyy.",
  );

export const gastoSchema = z.object({
  caminhao_id: z.number().int().positive().optional().nullable(),
  tipo_gasto_id: z.number().int().positive().optional().nullable(),
  data_gasto: dataStringSchema,
  valor: z.number().nonnegative(),
  descricao: z.string().optional().nullable(),
  km_registro: z.number().int().positive().optional().nullable(),
  quantidade_combustivel: z.number().nonnegative().optional().nullable(),
});

export const gastoUpdateSchema = gastoSchema.partial();
