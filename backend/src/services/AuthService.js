import prisma from "../lib/prisma.js";
import { config } from "../config/index.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";
import { logger } from "../utils/logger.js";

const DEFAULT_BOOTSTRAP = {
  email: "admin@abrotto.local",
  password: "admin123456",
  nome: "Administrador",
};

export class AuthService {
  static async ensureBootstrapAdmin() {
    const count = await prisma.users.count();
    if (count > 0) return;

    const email = (
      process.env.ADMIN_EMAIL || DEFAULT_BOOTSTRAP.email
    ).toLowerCase();
    const password = process.env.ADMIN_PASSWORD || DEFAULT_BOOTSTRAP.password;
    const nome = process.env.ADMIN_NOME || DEFAULT_BOOTSTRAP.nome;

    await prisma.users.create({
      data: {
        email,
        nome,
        role: "admin",
        password_hash: await hashPassword(password),
        ativo: true,
      },
    });

    logger.warn("Usuário administrador inicial criado", {
      email,
      hint: "Defina ADMIN_EMAIL e ADMIN_PASSWORD em produção e troque a senha após o primeiro login.",
    });
  }

  static async login({ email, password }) {
    await this.ensureBootstrapAdmin();

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.users.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user?.ativo) {
      throw new Error("Credenciais inválidas");
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      throw new Error("Credenciais inválidas");
    }

    const token = signAccessToken({
      sub: String(user.id),
      email: user.email,
      role: user.role,
      nome: user.nome,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        role: user.role,
      },
    };
  }

  static async getProfile(userId) {
    const user = await prisma.users.findUnique({
      where: { id: Number(userId) },
      select: {
        id: true,
        email: true,
        nome: true,
        role: true,
        ativo: true,
      },
    });

    if (!user?.ativo) {
      throw new Error("Usuário não encontrado");
    }

    return user;
  }

  static isJwtConfigured() {
    return Boolean(config.auth.jwtSecret);
  }
}
