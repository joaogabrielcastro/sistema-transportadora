import { z } from "zod";
import { FIELD_LIMITS } from "../utils/fieldLimits.js";
import {
  anoOptionalSchema,
  chassiOptionalSchema,
  optionalPlacaSchema,
  optionalString,
  placaSchema,
} from "./fieldSchemas.js";

/** "", NaN e ausência viram null; undefined em updates parciais permanece undefined. */
const optionalNumeroCaminhao = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === "" || val === null) return null;
  const n = typeof val === "number" ? val : Number(val);
  if (Number.isNaN(n)) return null;
  return n;
}, z
  .union([
    z.null(),
    z
      .number()
      .int()
      .nonnegative()
      .max(FIELD_LIMITS.NUMERO_CAVALO_MAX, "Número do cavalo inválido."),
  ])
  .optional());

const TIPOS_VEICULO = ["truck", "cavalo", "carreta"];

export const caminhaoSchema = z.object({
  placa: placaSchema,
  km_atual: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.coerce
      .number()
      .int()
      .nonnegative("O KM deve ser positivo ou zero.")
      .max(FIELD_LIMITS.KM_MAX)
      .nullable()
      .optional(),
  ),
  qtd_pneus: z.coerce
    .number()
    .int()
    .positive("A quantidade de pneus deve ser um número positivo.")
    .max(30, "Quantidade de pneus inválida."),
  motorista: optionalString(FIELD_LIMITS.MOTORISTA_TEXTO),
  motorista_id: z
    .preprocess((val) => {
      if (val === undefined) return undefined;
      if (val === "" || val === null) return null;
      const n = typeof val === "number" ? val : Number(val);
      if (Number.isNaN(n)) return null;
      return n;
    }, z.union([z.null(), z.number().int().positive()]).optional()),
  marca: optionalString(FIELD_LIMITS.MARCA),
  modelo: optionalString(FIELD_LIMITS.MODELO),
  ano: anoOptionalSchema,
  numero_carreta_1: optionalNumeroCaminhao,
  placa_carreta_1: optionalPlacaSchema,
  numero_carreta_2: optionalNumeroCaminhao,
  placa_carreta_2: optionalPlacaSchema,
  numero_cavalo: optionalNumeroCaminhao,
  tipo_veiculo: z.enum(TIPOS_VEICULO).default("truck"),
  config_eixos: optionalString(FIELD_LIMITS.CONFIG_EIXOS),
  com_4_eixo: z.boolean().optional(),
  chassi: chassiOptionalSchema,
  empresa: optionalString(FIELD_LIMITS.EMPRESA),
});

export const caminhaoUpdateSchema = caminhaoSchema.partial();

export const vinculoComposicaoSchema = z.object({
  carreta_id: z.number().int().positive(),
  ordem: z.number().int().min(1).max(2).optional().default(1),
});
