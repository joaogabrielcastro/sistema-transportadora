import { z } from "zod";

export const ROLES = ["admin", "operator"];

export const createUserSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  nome: z.string().trim().min(2, "Nome obrigatório").max(120),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").max(128),
  role: z.enum(["admin", "operator"]).default("operator"),
});

export const updateUserSchema = z
  .object({
    nome: z.string().trim().min(2).max(120).optional(),
    role: z.enum(["admin", "operator"]).optional(),
    ativo: z.boolean().optional(),
    password: z.string().min(8).max(128).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });
