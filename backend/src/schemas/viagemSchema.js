import { z } from "zod";

const texto = (max) => z.string().trim().max(max);
const textoOpcional = (max) =>
  z.preprocess((v) => (v === "" ? null : v), texto(max).nullable().optional());
const dataHora = z.coerce.date({ message: "Data e hora inválidas" });
const km = z.coerce.number().int("Quilometragem deve ser um número inteiro").min(0).max(99_999_999);
const idPositivo = z.coerce.number().int().positive();

export const VIAGEM_STATUS = ["planejada", "em_andamento", "finalizada", "cancelada"];

export const createViagemSchema = z
  .object({
    caminhao_id: idPositivo,
    motorista_id: idPositivo,
    saida_em: dataHora,
    origem: texto(160).min(2, "Informe a origem"),
    destino: texto(160).min(2, "Informe o destino"),
    km_inicial: km,
    observacoes: textoOpcional(2000),
    /** false grava como planejada (sem iniciar). */
    iniciar: z.boolean().default(true),
  })
  .strict();

export const startViagemSchema = z
  .object({
    saida_em: dataHora.optional(),
    km_inicial: km.optional(),
  })
  .strict();

export const finishViagemSchema = z
  .object({
    chegada_em: dataHora,
    km_final: km,
    observacoes_encerramento: textoOpcional(2000),
    ocorrencias: textoOpcional(2000),
  })
  .strict();

export const updateViagemSchema = z
  .object({
    caminhao_id: idPositivo.optional(),
    motorista_id: idPositivo.optional(),
    saida_em: dataHora.optional(),
    chegada_em: dataHora.optional(),
    origem: texto(160).min(2).optional(),
    destino: texto(160).min(2).optional(),
    km_inicial: km.optional(),
    km_final: km.optional(),
    observacoes: textoOpcional(2000),
    observacoes_encerramento: textoOpcional(2000),
    ocorrencias: textoOpcional(2000),
    motivo: textoOpcional(500),
  })
  .strict()
  .refine((b) => Object.keys(b).some((k) => k !== "motivo"), {
    message: "Informe ao menos um campo para alterar",
  });

export const cancelViagemSchema = z
  .object({ motivo: texto(500).min(3, "Informe o motivo do cancelamento") })
  .strict();

// Multipart (comprovante) chega tudo como texto: coerção nos números.
export const despesaSchema = z
  .object({
    tipo_gasto_id: idPositivo,
    descricao: texto(500).min(2, "Descreva a despesa"),
    valor: z.coerce
      .number({ message: "Valor inválido" })
      .positive("O valor deve ser maior que zero")
      .max(99_999_999.99),
    registrado_em: dataHora,
    quantidade_combustivel: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.coerce.number().positive().max(100_000).nullable().optional(),
    ),
    km_registro: z.preprocess((v) => (v === "" || v == null ? null : v), km.nullable().optional()),
  })
  .strict();

export const updateDespesaSchema = despesaSchema
  .partial()
  .extend({ motivo: textoOpcional(500) })
  .strict();

export const deleteDespesaSchema = z
  .object({ motivo: texto(500).min(3, "Informe o motivo da exclusão") })
  .strict();

const lista = (v) => (typeof v === "string" && v.includes(",") ? v.split(",") : v);

export const listViagensQuerySchema = z.object({
  status: z.preprocess(lista, z.union([z.enum(VIAGEM_STATUS), z.array(z.enum(VIAGEM_STATUS))]).optional()),
  caminhao_id: idPositivo.optional(),
  motorista_id: idPositivo.optional(),
  de: dataHora.optional(),
  ate: dataHora.optional(),
  origem: texto(160).optional(),
  destino: texto(160).optional(),
  q: texto(160).optional(),
  com_ocorrencias: z.preprocess((v) => v === "1" || v === "true" || v === true, z.boolean()).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const resumoViagensQuerySchema = z.object({
  de: dataHora.optional(),
  ate: dataHora.optional(),
  caminhao_id: idPositivo.optional(),
  motorista_id: idPositivo.optional(),
});
