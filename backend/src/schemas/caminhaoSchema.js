import { z } from "zod";

/** "", NaN e ausência viram null; undefined em updates parciais permanece undefined. */
const optionalNumeroCaminhao = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === "" || val === null) return null;
  const n = typeof val === "number" ? val : Number(val);
  if (Number.isNaN(n)) return null;
  return n;
}, z.union([z.null(), z.number().int().nonnegative()]).optional());

const TIPOS_VEICULO = ["truck", "cavalo", "carreta"];

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
  motorista_id: z
    .preprocess((val) => {
      if (val === undefined) return undefined;
      if (val === "" || val === null) return null;
      const n = typeof val === "number" ? val : Number(val);
      if (Number.isNaN(n)) return null;
      return n;
    }, z.union([z.null(), z.number().int().positive()]).optional()),
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
  tipo_veiculo: z.enum(TIPOS_VEICULO).default("truck"),
  config_eixos: z.string().max(32).nullable().optional(),
  com_4_eixo: z.boolean().optional(),
  chassi: z.string().max(40).nullable().optional(),
  empresa: z.string().max(80).nullable().optional(),
});

export const caminhaoUpdateSchema = caminhaoSchema.partial();

export const vinculoComposicaoSchema = z.object({
  carreta_id: z.number().int().positive(),
  ordem: z.number().int().min(1).max(2).optional().default(1),
});
