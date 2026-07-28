import prisma from "../lib/prisma.js";
import { hashPassword } from "../utils/password.js";
import { logger } from "../utils/logger.js";

const userSelect = {
  id: true,
  email: true,
  nome: true,
  role: true,
  ativo: true,
  criado_em: true,
  tenant_id: true,
};

export class UserService {
  static async list(tenantId) {
    return prisma.users.findMany({
      where: { tenant_id: Number(tenantId) },
      select: userSelect,
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    });
  }

  static async create(tenantId, { email, nome, password, role }, actorUserId) {
    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await prisma.users.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      const err = new Error(
        "Já existe um usuário com este e-mail no sistema.",
      );
      err.statusCode = 409;
      throw err;
    }

    const user = await prisma.users.create({
      data: {
        tenant_id: Number(tenantId),
        email: normalizedEmail,
        nome: String(nome).trim(),
        role: role === "admin" ? "admin" : "operator",
        password_hash: await hashPassword(password),
        ativo: true,
      },
      select: userSelect,
    });

    logger.info("Usuário criado no tenant", {
      tenantId,
      userId: user.id,
      role: user.role,
      by: actorUserId,
    });

    return user;
  }

  static async update(tenantId, userId, data, actorUserId) {
    const id = Number(userId);
    const existing = await prisma.users.findFirst({
      where: { id, tenant_id: Number(tenantId) },
    });

    if (!existing) {
      const err = new Error("Usuário não encontrado");
      err.statusCode = 404;
      throw err;
    }

    if (data.role && data.role !== existing.role) {
      await this.assertCanChangeRole(tenantId, existing, data.role, actorUserId);
    }

    if (data.ativo === false && existing.ativo) {
      await this.assertCanDeactivate(tenantId, existing, actorUserId);
    }

    const patch = {};
    if (data.nome != null) patch.nome = String(data.nome).trim();
    if (data.role != null) {
      patch.role = data.role === "admin" ? "admin" : "operator";
    }
    if (data.ativo != null) patch.ativo = Boolean(data.ativo);
    if (data.password) {
      patch.password_hash = await hashPassword(data.password);
    }

    return prisma.users.update({
      where: { id },
      data: patch,
      select: userSelect,
    });
  }

  static async assertCanChangeRole(tenantId, target, newRole, actorUserId) {
    if (Number(target.id) === Number(actorUserId) && newRole !== "admin") {
      const err = new Error("Você não pode remover o próprio perfil de admin");
      err.statusCode = 400;
      throw err;
    }

    if (target.role === "admin" && newRole !== "admin") {
      const adminCount = await prisma.users.count({
        where: {
          tenant_id: Number(tenantId),
          role: "admin",
          ativo: true,
        },
      });
      if (adminCount <= 1) {
        const err = new Error(
          "A empresa precisa ter pelo menos um administrador ativo",
        );
        err.statusCode = 400;
        throw err;
      }
    }
  }

  static async assertCanDeactivate(tenantId, target, actorUserId) {
    if (Number(target.id) === Number(actorUserId)) {
      const err = new Error("Você não pode desativar a própria conta");
      err.statusCode = 400;
      throw err;
    }

    if (target.role === "admin") {
      const adminCount = await prisma.users.count({
        where: {
          tenant_id: Number(tenantId),
          role: "admin",
          ativo: true,
        },
      });
      if (adminCount <= 1) {
        const err = new Error(
          "A empresa precisa ter pelo menos um administrador ativo",
        );
        err.statusCode = 400;
        throw err;
      }
    }
  }
}
