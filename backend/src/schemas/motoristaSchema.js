import { z } from "zod";
import { FIELD_LIMITS } from "../utils/fieldLimits.js";
import {
  cpfOptionalSchema,
  observacaoOptionalSchema,
  phoneOptionalSchema,
  requiredString,
} from "./fieldSchemas.js";

export const motoristaSchema = z.object({
  nome: requiredString(FIELD_LIMITS.NOME, 2),
  cpf: cpfOptionalSchema,
  cnh: z.preprocess((val) => {
    if (val === undefined) return undefined;
    if (val === null || String(val).trim() === "") return null;
    return String(val).trim();
  }, z.string().max(FIELD_LIMITS.CNH).nullable().optional()),
  cnh_categoria: z.preprocess((val) => {
    if (val === undefined) return undefined;
    if (val === null || String(val).trim() === "") return null;
    return String(val).trim().toUpperCase();
  }, z.string().max(FIELD_LIMITS.CNH_CATEGORIA).nullable().optional()),
  cnh_validade: z.string().optional().nullable(),
  telefone: phoneOptionalSchema,
  whatsapp: phoneOptionalSchema,
  ativo: z.boolean().optional(),
  observacao: observacaoOptionalSchema,
  // Código do iButton (chaveiro 1-Wire) lido pelo rastreador FMB130, em hexadecimal.
  ibutton_id: z.preprocess((val) => {
    if (val === undefined) return undefined;
    if (val === null || String(val).trim() === "") return null;
    const hex = String(val).trim().toUpperCase().replace(/^0X/, "").replace(/[\s:-]/g, "");
    return hex.padStart(16, "0");
  }, z.string().regex(/^[0-9A-F]{16}$/, "iButton inválido: use até 16 dígitos hexadecimais.").nullable().optional()),
});

export const motoristaUpdateSchema = motoristaSchema.partial();
