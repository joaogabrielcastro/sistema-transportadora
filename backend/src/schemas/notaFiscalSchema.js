import { z } from "zod";
import { dataStringSchema } from "./shared.js";

const emptyToNull = (v) => (v === "" || v === undefined ? null : v);

const moneyOptional = z.preprocess(
  emptyToNull,
  z.coerce.number().nonnegative().optional().nullable(),
);

const itemManualSchema = z.object({
  id: z.coerce.number().int().positive().optional().nullable(),
  codigo: z.preprocess(emptyToNull, z.string().trim().max(60).optional().nullable()),
  descricao: z.string().trim().min(1, "Informe a descrição do item").max(500),
  unidade: z.preprocess(
    emptyToNull,
    z.string().trim().max(20).optional().nullable(),
  ),
  ncm: z.preprocess(emptyToNull, z.string().trim().max(20).optional().nullable()),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero"),
  valor_unitario: z.coerce.number().nonnegative().optional().nullable(),
  valor_total: z.coerce.number().nonnegative().optional().nullable(),
  valor_desconto: moneyOptional,
  valor_ipi: moneyOptional,
});

export const notaManualSchema = z.object({
  numero: z.string().trim().min(1, "Informe o número da nota").max(20),
  serie: z.preprocess(emptyToNull, z.string().trim().max(10).optional().nullable()),
  emitente: z.string().trim().min(1, "Informe o fornecedor").max(255),
  cnpj_emitente: z.preprocess(
    emptyToNull,
    z.string().trim().max(18).optional().nullable(),
  ),
  data_emissao: z.preprocess(emptyToNull, dataStringSchema.optional().nullable()),
  data_vencimento: z.preprocess(
    emptyToNull,
    dataStringSchema.optional().nullable(),
  ),
  condicao_pagamento: z.preprocess(
    emptyToNull,
    z.string().trim().max(80).optional().nullable(),
  ),
  chave_acesso: z.preprocess(
    emptyToNull,
    z.string().trim().max(44).optional().nullable(),
  ),
  observacao: z.preprocess(
    emptyToNull,
    z.string().trim().max(2000).optional().nullable(),
  ),
  caminhao_id: z.preprocess(
    emptyToNull,
    z.coerce.number().int().positive().optional().nullable(),
  ),
  valor_total: moneyOptional,
  valor_desconto: moneyOptional,
  valor_frete: moneyOptional,
  valor_ipi: moneyOptional,
  itens: z.array(itemManualSchema).min(1, "Inclua ao menos um item"),
});

export const notaAtualizarSchema = notaManualSchema;
