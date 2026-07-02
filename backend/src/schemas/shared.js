import { z } from "zod";

export const dataStringSchema = z
  .string()
  .regex(
    /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/,
    "Use o formato de data YYYY-MM-DD ou dd/MM/yyyy.",
  );
