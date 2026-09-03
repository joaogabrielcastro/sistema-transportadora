import { z } from "zod";
import { FIELD_LIMITS } from "../utils/fieldLimits.js";
import { dataStringSchema } from "./shared.js";
import {
  cpfCnpjOptionalSchema,
  moneyOptionalSchema,
  observacaoOptionalSchema,
  requiredString,
} from "./fieldSchemas.js";

const emptyToNull = (v) => (v === "" || v === undefined ? null : v);

const itemManualSchema = z.object({
  id: z.coerce.number().int().positive().optional().nullable(),
  codigo: z.preprocess(
    emptyToNull,
    z.string().trim().max(FIELD_LIMITS.CODIGO_PRODUTO).optional().nullable(),
  ),
  descricao: requiredString(FIELD_LIMITS.DESCRICAO),
  unidade: z.preprocess(
    emptyToNull,
    z.string().trim().max(FIELD_LIMITS.UNIDADE).optional().nullable(),
  ),
  ncm: z.preprocess(
    emptyToNull,
    z.string().trim().max(FIELD_LIMITS.NCM).optional().nullable(),
  ),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero"),
  valor_unitario: moneyOptionalSchema,
  valor_total: moneyOptionalSchema,
  valor_desconto: moneyOptionalSchema,
  valor_ipi: moneyOptionalSchema,
});

export const notaManualSchema = z.object({
  numero: requiredString(FIELD_LIMITS.NOTA_NUMERO),
  serie: z.preprocess(
    emptyToNull,
    z.string().trim().max(FIELD_LIMITS.NOTA_SERIE).optional().nullable(),
  ),
  emitente: requiredString(FIELD_LIMITS.EMITENTE),
  cnpj_emitente: cpfCnpjOptionalSchema,
  data_emissao: z.preprocess(emptyToNull, dataStringSchema.optional().nullable()),
  data_vencimento: z.preprocess(
    emptyToNull,
    dataStringSchema.optional().nullable(),
  ),
  condicao_pagamento: z.preprocess(
    emptyToNull,
    z.string().trim().max(FIELD_LIMITS.CONDICAO_PAGAMENTO).optional().nullable(),
  ),
  chave_acesso: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(FIELD_LIMITS.CHAVE_ACESSO)
      .refine(
        (v) => !v || /^\d{44}$/.test(v.replace(/\D/g, "")),
        "Chave de acesso deve ter 44 dígitos.",
      )
      .optional()
      .nullable(),
  ),
  observacao: observacaoOptionalSchema,
  caminhao_id: z.preprocess(
    emptyToNull,
    z.coerce.number().int().positive().optional().nullable(),
  ),
  valor_total: moneyOptionalSchema,
  valor_desconto: moneyOptionalSchema,
  valor_frete: moneyOptionalSchema,
  valor_ipi: moneyOptionalSchema,
  itens: z.array(itemManualSchema).min(1, "Inclua ao menos um item"),
});

export const notaAtualizarSchema = notaManualSchema;
