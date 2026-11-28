import { z } from "zod";
import { CONFIGURABLE_PERMISSIONS } from "../utils/permissions.js";

export const ROLES = ["admin", "operator", "viewer"];

export const createUserSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  nome: z.string().trim().min(2, "Nome obrigatório").max(120),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").max(128),
  role: z.enum(ROLES).default("operator"),
});

export const inviteUserSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  nome: z.string().trim().min(2, "Nome obrigatório").max(120),
  role: z.enum(ROLES).default("operator"),
});

export const updateUserSchema = z
  .object({
    nome: z.string().trim().min(2).max(120).optional(),
    role: z.enum(ROLES).optional(),
    ativo: z.boolean().optional(),
    password: z.string().min(8).max(128).optional(),
    /** Conjunto desejado das permissões configuráveis (o servidor grava a diferença para o perfil). */
    permissions: z
      .array(z.enum(CONFIGURABLE_PERMISSIONS))
      .max(CONFIGURABLE_PERMISSIONS.length)
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });
