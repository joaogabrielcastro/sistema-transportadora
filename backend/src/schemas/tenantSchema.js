import { z } from "zod";

const optionalEmail = z
  .union([z.string().trim().email("E-mail inválido").max(255), z.literal("")])
  .optional()
  .nullable();

export const updateTenantSettingsSchema = z
  .object({
    nome: z.string().trim().min(2, "Nome obrigatório").max(120).optional(),
    alertEmail: optionalEmail,
    whatsappNotifyPhone: z
      .string()
      .trim()
      .max(30)
      .optional()
      .nullable(),
    weeklyDigestEnabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });

export const closeAccountSchema = z.object({
  confirmName: z.string().trim().min(2, "Confirme o nome da empresa").max(120),
});

export function confirmNameMatches(tenantNome, confirmName) {
  return (
    String(tenantNome || "").trim().toLowerCase() ===
    String(confirmName || "").trim().toLowerCase()
  );
}
