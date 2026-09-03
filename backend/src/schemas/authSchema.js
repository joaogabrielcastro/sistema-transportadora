import { z } from "zod";
import { LEGAL_ACCEPT_MESSAGE } from "../utils/legal.js";

const acceptedLegalField = z.boolean().refine((value) => value === true, {
  message: LEGAL_ACCEPT_MESSAGE,
});

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

export const registerSchema = z.object({
  empresaNome: z
    .string()
    .trim()
    .min(2, "Nome da empresa deve ter pelo menos 2 caracteres")
    .max(120, "Nome da empresa muito longo"),
  nome: z.string().trim().max(120).optional(),
  email: z.string().trim().email("E-mail inválido"),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(128),
  acceptedLegal: acceptedLegalField,
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(16, "Link inválido ou incompleto"),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(128),
});

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(16, "Link inválido ou incompleto"),
  password: z
    .string()
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(128),
  nome: z.string().trim().min(2).max(120).optional(),
  acceptedLegal: acceptedLegalField,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual"),
  newPassword: z
    .string()
    .min(8, "A nova senha deve ter no mínimo 8 caracteres")
    .max(128),
});

export const registrosListSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  caminhaoId: z.coerce.number().int().positive().optional(),
  placa: z.string().optional(),
  dataInicio: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dataInicio inválida")
    .optional(),
  dataFim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dataFim inválida")
    .optional(),
  tipo: z.enum(["gasto", "manutencao", "todos"]).optional(),
});
