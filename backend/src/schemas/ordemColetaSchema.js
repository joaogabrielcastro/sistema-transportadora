import { z } from "zod";
import { FIELD_LIMITS } from "../utils/fieldLimits.js";

const dadosVariaveisSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.null()]))
  .optional()
  .default({})
  .superRefine((obj, ctx) => {
    const keys = Object.keys(obj);
    if (keys.length > FIELD_LIMITS.ORDEM_DADOS_MAX_KEYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Muitos campos (máximo ${FIELD_LIMITS.ORDEM_DADOS_MAX_KEYS}).`,
      });
    }
    for (const k of keys) {
      if (k.length > FIELD_LIMITS.ORDEM_DADOS_KEY_MAX) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Chave de dados inválida: "${k.slice(0, 20)}…"`,
        });
        break;
      }
      const val = obj[k];
      if (val != null && String(val).length > FIELD_LIMITS.ORDEM_CAMPO_TEXTAREA) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Campo "${k}" excede ${FIELD_LIMITS.ORDEM_CAMPO_TEXTAREA} caracteres.`,
        });
        break;
      }
    }
  });

const placaOptional = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || String(v).trim() === "") return null;
    return String(v).trim().toUpperCase().replace(/-/g, "").slice(0, FIELD_LIMITS.PLACA);
  });

export const ordemColetaBaseSchema = z.object({
  tipo: z.enum(["PADRAO", "CANOINHAS"]),
  placa: placaOptional,
  dadosVariaveis: dadosVariaveisSchema,
});

export const ordemColetaPreviewSchema = ordemColetaBaseSchema;

export const ordemColetaPdfSchema = ordemColetaBaseSchema;

export const ordemColetaEnviarSchema = ordemColetaBaseSchema.extend({
  emailDestinatario: z.string().trim().email("E-mail do destinatário inválido."),
  assunto: z.string().trim().max(FIELD_LIMITS.ASSUNTO_EMAIL).optional(),
});

export const ordemColetaHistoricoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
