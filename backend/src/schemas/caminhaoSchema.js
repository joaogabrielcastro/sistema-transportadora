import { z } from "zod";

export const caminhaoSchema = z.object({
  placa: z.string().min(7, "A placa deve ter no mínimo 7 caracteres."),
  km_atual: z
    .number()
    .nonnegative("O KM deve ser positivo ou zero.")
    .nullable()
    .optional(),
  qtd_pneus: z
    .number()
    .int()
    .positive("A quantidade de pneus deve ser um número positivo."),
  motorista: z.string().nullable().optional(),
  marca: z.string().nullable().optional(),
  modelo: z.string().nullable().optional(),
  ano: z
    .number()
    .int()
    .min(1900, "Ano deve ser maior que 1900")
    .max(new Date().getFullYear() + 1, "Ano inválido")
    .nullable()
    .optional(),
  numero_carreta_1: z.number().int().nonnegative().nullable().optional(),
  placa_carreta_1: z.string().nullable().optional(),
  numero_carreta_2: z.number().int().nonnegative().nullable().optional(),
  placa_carreta_2: z.string().nullable().optional(),
  numero_cavalo: z.number().int().nonnegative().nullable().optional(),
});

export const caminhaoUpdateSchema = caminhaoSchema.partial();
