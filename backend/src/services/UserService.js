import prisma from "../lib/prisma.js";
import { hashPassword } from "../utils/password.js";
import { logger } from "../utils/logger.js";
import { normalizeRole } from "../utils/permissions.js";
import { assertMailConfigured, sendMail } from "../utils/mailer.js";
import { config } from "../config/index.js";
import {
  AUTH_TOKEN_PURPOSE,
  AUTH_TOKEN_TTL,
  generateAuthToken,
} from "../utils/authTokens.js";
import { assertCanAddUserSeat } from "../utils/planQuotas.js";

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

    const tenant = await prisma.tenants.findUnique({
      where: { id: Number(tenantId) },
      select: { id: true, plan: true, billing_exempt: true },
    });
    if (!tenant) {
      const err = new Error("Empresa não encontrada");
      err.statusCode = 404;
      throw err;
    }
    await assertCanAddUserSeat(prisma, tenant);

    const user = await prisma.users.create({
      data: {
        tenant_id: Number(tenantId),
        email: normalizedEmail,
        nome: String(nome).trim(),
        role: normalizeRole(role),
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

  static async invite(tenantId, { email, nome, role }, actorUserId) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const displayNome = String(nome).trim();
    const normalizedRole = normalizeRole(role);

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

    const tenant = await prisma.tenants.findUnique({
      where: { id: Number(tenantId) },
      select: {
        id: true,
        nome: true,
        ativo: true,
        plan: true,
        billing_exempt: true,
      },
    });
    if (!tenant?.ativo) {
      const err = new Error("Empresa inativa");
      err.statusCode = 400;
      throw err;
    }

    await assertCanAddUserSeat(prisma, tenant);
    assertMailConfigured();

    await prisma.auth_tokens.updateMany({
      where: {
        purpose: AUTH_TOKEN_PURPOSE.INVITE,
        email: normalizedEmail,
        tenant_id: Number(tenantId),
        used_at: null,
      },
      data: { used_at: new Date() },
    });

    const { raw, hash } = generateAuthToken();
    await prisma.auth_tokens.create({
      data: {
        purpose: AUTH_TOKEN_PURPOSE.INVITE,
        email: normalizedEmail,
        tenant_id: Number(tenantId),
        role: normalizedRole,
        nome: displayNome,
        token_hash: hash,
        expires_at: new Date(Date.now() + AUTH_TOKEN_TTL.INVITE_MS),
        created_by: Number.isInteger(Number(actorUserId))
          ? Number(actorUserId)
          : null,
      },
    });

    const base = (config.billing.frontendUrl || "").replace(/\/$/, "");
    const link = `${base}/convite?token=${encodeURIComponent(raw)}`;
    const roleLabel =
      normalizedRole === "admin"
        ? "Administrador"
        : normalizedRole === "viewer"
          ? "Somente leitura"
          : "Operador";

    await sendMail({
      to: normalizedEmail,
      subject: `Convite para ${tenant.nome} — ATrack`,
      text: `${displayNome}, você foi convidado(a) para a empresa ${tenant.nome} no ATrack (perfil: ${roleLabel}).\n\nDefina sua senha neste link (válido por 7 dias):\n${link}\n`,
      html: `<p>${escapeHtml(displayNome)}, você foi convidado(a) para <strong>${escapeHtml(tenant.nome)}</strong> no ATrack.</p><p>Perfil: ${escapeHtml(roleLabel)}.</p><p><a href="${escapeHtml(link)}">Aceitar convite e definir senha</a></p><p>O link vale por 7 dias.</p>`,
    });

    logger.info("Convite de usuário enviado", {
      tenantId,
      email: normalizedEmail,
      role: normalizedRole,
      by: actorUserId,
    });

    return {
      email: normalizedEmail,
      nome: displayNome,
      role: normalizedRole,
      expiresInDays: 7,
    };
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

    if (data.ativo === true && !existing.ativo) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: Number(tenantId) },
        select: { id: true, plan: true, billing_exempt: true },
      });
      await assertCanAddUserSeat(prisma, tenant);
    }

    const patch = {};
    if (data.nome != null) patch.nome = String(data.nome).trim();
    if (data.role != null) {
      patch.role = normalizeRole(data.role);
    }
    if (data.ativo != null) patch.ativo = Boolean(data.ativo);
    if (data.password) {
      patch.password_hash = await hashPassword(data.password);
    }

    const updated = await prisma.users.updateMany({
      where: { id, tenant_id: Number(tenantId) },
      data: patch,
    });
    if (updated.count === 0) {
      const err = new Error("Usuário não encontrado");
      err.statusCode = 404;
      throw err;
    }

    return prisma.users.findFirst({
      where: { id, tenant_id: Number(tenantId) },
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
