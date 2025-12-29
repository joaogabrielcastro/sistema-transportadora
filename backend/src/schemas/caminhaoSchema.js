import { z } from "zod";

export const caminhaoSchema = z.object({
  placa: z.string().min(7, "A placa deve ter no mínimo 7 caracteres."),
  km_atual: z
    .number()
    .nonnegative("O KM deve ser positivo ou zero.")
    .optional()
    .nullable(),
  qtd_pneus: z
    .number()
    .int()
    .positive("A quantidade de pneus deve ser um número positivo."),
  motorista: z.string().optional().nullable(),
  marca: z.string().optional().nullable(),
  modelo: z.string().optional().nullable(),
  ano: z
    .number()
    .int()
    .min(1900, "Ano deve ser maior que 1900")
    .max(new Date().getFullYear() + 1, "Ano inválido")
    .optional()
    .nullable(),
  numero_carreta_1: z.number().int().nonnegative().optional().nullable(),
  placa_carreta_1: z.string().optional().nullable(),
  numero_carreta_2: z.number().int().nonnegative().optional().nullable(),
  placa_carreta_2: z.string().optional().nullable(),
  numero_cavalo: z.number().int().nonnegative().optional().nullable(),
});

export const caminhaoUpdateSchema = caminhaoSchema.partial();
