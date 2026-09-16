import { z } from "zod";
import { dataStringSchema } from "./shared.js";
import {
  descricaoOptionalSchema,
  kmOptionalSchema,
  moneyOptionalSchema,
  moneySchema,
} from "./fieldSchemas.js";
import { sanitizeGastoDetalhes } from "../utils/gastoDetalhes.js";

const optionalPositiveId = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === "" || val === null) return null;
  const n = typeof val === "number" ? val : Number(val);
  return Number.isNaN(n) ? null : n;
}, z.union([z.null(), z.number().int().positive()]).optional());

const statusPagamentoSchema = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === null || val === "") return null;
  return String(val).trim().toLowerCase();
}, z
  .enum(["pago", "pendente", "em_recurso", "cancelado"])
  .nullable()
  .optional());

const dataOptionalSchema = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === null || val === "") return null;
  return val;
}, dataStringSchema.nullable().optional());

const detalhesSchema = z.preprocess(
  (val) => {
    if (val === undefined) return undefined;
    return sanitizeGastoDetalhes(val);
  },
  z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).nullable().optional(),
);

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
  motorista_id: optionalPositiveId,
  status_pagamento: statusPagamentoSchema,
  data_vencimento: dataOptionalSchema,
  detalhes: detalhesSchema,
});

export const gastoUpdateSchema = gastoSchema.partial();
