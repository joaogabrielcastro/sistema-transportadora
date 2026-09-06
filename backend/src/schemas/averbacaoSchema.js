import { z } from "zod";
import { optionalString } from "./fieldSchemas.js";

export const averbacaoAmbienteSchema = z.enum(["homologacao", "producao"]);
export const averbacaoProviderSchema = z.enum(["atm"]);

const emptyToUndefined = (val) => {
  if (val === undefined) return undefined;
  if (val === null || val === "") return null;
  return val;
};

export const salvarSeguroConfigSchema = z.object({
  provider: averbacaoProviderSchema.default("atm"),
  ambiente: averbacaoAmbienteSchema.default("homologacao"),
  automatico: z.boolean().optional(),
  ativo: z.boolean().optional(),
  seguradora: optionalString(80),
  numero_apolice: optionalString(40),
  tipo_cobertura: optionalString(40),
  codigo_atm: optionalString(32),
  usuario: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(120).nullable().optional(),
  ),
  senha: z.preprocess(
    emptyToUndefined,
    z.string().max(120).nullable().optional(),
  ),
});

export const solicitarAverbacaoSchema = z
  .object({
    cte_id: z.coerce.number().int().positive().optional(),
    mdfe_id: z.coerce.number().int().positive().optional(),
  })
  .refine(
    (v) => (Boolean(v.cte_id) && !v.mdfe_id) || (Boolean(v.mdfe_id) && !v.cte_id),
    { message: "Informe cte_id ou mdfe_id (somente um)." },
  );

export const averbacaoIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
