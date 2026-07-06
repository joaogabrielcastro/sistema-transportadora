import { z } from "zod";
import { dataStringSchema } from "./shared.js";

export const costPerKmQuerySchema = z.object({
  startDate: dataStringSchema.optional(),
  endDate: dataStringSchema.optional(),
  caminhaoId: z.coerce.number().int().positive().optional(),
  entriesLimit: z.coerce.number().int().min(1).max(1000).optional().default(500),
});
