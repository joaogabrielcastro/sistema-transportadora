import { z } from "zod";

const dadosVariaveisSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.null()]))
  .optional()
  .default({})
  .superRefine((obj, ctx) => {
    const keys = Object.keys(obj);
    if (keys.length > 80) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Muitos campos em dadosVariaveis (máximo 80).",
      });
    }
    for (const k of keys) {
      if (k.length > 64) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Chave de dados inválida: "${k.slice(0, 20)}…"`,
        });
        break;
      }
    }
  });

const placaOptional = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || String(v).trim() === "") return null;
    return String(v).trim().toUpperCase().replace(/-/g, "");
  });

export const ordemColetaBaseSchema = z.object({
  /** PADRAO = modelo genérico. CANOINHAS = id legado para o template “autorização compacta” (exemplo de cliente), não nome do tomador padrão. */
  tipo: z.enum(["PADRAO", "CANOINHAS"]),
  placa: placaOptional,
  dadosVariaveis: dadosVariaveisSchema,
});

export const ordemColetaPreviewSchema = ordemColetaBaseSchema;

export const ordemColetaPdfSchema = ordemColetaBaseSchema;

export const ordemColetaEnviarSchema = ordemColetaBaseSchema.extend({
  emailDestinatario: z.string().trim().email("E-mail do destinatário inválido."),
  assunto: z.string().trim().max(500).optional(),
});

export const ordemColetaHistoricoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
