import { z } from "zod";

/** "", NaN e ausência viram null; undefined em updates parciais permanece undefined. */
const optionalNumeroCaminhao = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === "" || val === null) return null;
  const n = typeof val === "number" ? val : Number(val);
  if (Number.isNaN(n)) return null;
  return n;
}, z.union([z.null(), z.number().int().nonnegative()]).optional());

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
  numero_carreta_1: optionalNumeroCaminhao,
  placa_carreta_1: z.string().nullable().optional(),
  numero_carreta_2: optionalNumeroCaminhao,
  placa_carreta_2: z.string().nullable().optional(),
  numero_cavalo: optionalNumeroCaminhao,
});

export const caminhaoUpdateSchema = caminhaoSchema.partial();
