import { z } from "zod";
import { dataStringSchema } from "./shared.js";
import {
  descricaoOptionalSchema,
  kmOptionalSchema,
  moneyOptionalSchema,
  moneySchema,
} from "./fieldSchemas.js";

export const gastoSchema = z.object({
  caminhao_id: z.coerce.number().int().positive(),
  tipo_gasto_id: z.coerce.number().int().positive(),
  data_gasto: dataStringSchema,
  valor: moneySchema,
  descricao: descricaoOptionalSchema,
  km_registro: kmOptionalSchema,
  quantidade_combustivel: moneyOptionalSchema,
  produto_id: z.coerce.number().int().positive().optional().nullable(),
  quantidade_estoque: z.coerce.number().positive().optional().nullable(),
});

export const gastoUpdateSchema = gastoSchema.partial();
