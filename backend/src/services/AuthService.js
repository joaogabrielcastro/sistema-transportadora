import {
  buildBillingPublic,
  newTenantBillingDefaults,
} from "../utils/tenantFeatures.js";
import { resolvePermissions } from "../utils/permissions.js";
import { config } from "../config/index.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { signAccessToken } from "../utils/jwt.js";
import { logger } from "../utils/logger.js";
import { ensureSeedTenant } from "../utils/tenant.js";
import prisma from "../lib/prisma.js";
import { isMailConfigured, sendMail } from "../utils/mailer.js";
import {
  AUTH_TOKEN_PURPOSE,
  AUTH_TOKEN_TTL,
  generateAuthToken,
  hashAuthToken,
  isAuthTokenUsable,
} from "../utils/authTokens.js";
import { LEGAL_VERSION } from "../utils/legal.js";
import {
  assertCanAddUserSeat,
  getQuotaUsage,
} from "../utils/planQuotas.js";

const DEFAULT_BOOTSTRAP = {
  email: "admin@abrotto.local",
  password: "admin123456",
  nome: "Administrador",
};

const TENANT_BILLING_SELECT = {
  id: true,
  slug: true,
  ativo: true,
  nome: true,
  features: true,
  billing_exempt: true,
  plan: true,
  subscription_status: true,
  trial_ends_at: true,
  onboarding_completed_at: true,
};

/** Gera slug URL-safe a partir do nome da empresa. */
export function slugifyTenantName(nome) {
  const base = String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base || "empresa";
}

async function allocateUniqueSlug(baseSlug, tx = prisma) {
  let slug = baseSlug.slice(0, 64);
  let n = 2;
  while (await tx.tenants.findUnique({ where: { slug } })) {
    const suffix = `-${n}`;
    slug = `${baseSlug.slice(0, 64 - suffix.length)}${suffix}`;
    n += 1;
    if (n > 999) {
      const err = new Error(
        "Não foi possível gerar identificador único da empresa",
      );
      err.statusCode = 409;
      throw err;
    }
  }
  return slug;
}

function buildAuthPayload(user, tenant) {
  const tenantId = user.tenant_id ?? tenant?.id;
  const billing = buildBillingPublic(tenant);
  const permissions = resolvePermissions(user.role, user.permissions);
  const token = signAccessToken({
    sub: String(user.id),
    email: user.email,
    role: user.role,
    nome: user.nome,
    tenantId,
    permissions,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role,
      permissions,
      tenantId,
      tenantSlug: tenant?.slug ?? null,
      tenantNome: tenant?.nome ?? null,
      features: billing.features,
      billingExempt: billing.billingExempt,
      plan: billing.plan,
      subscriptionStatus: billing.subscriptionStatus,
      trialEndsAt: billing.trialEndsAt,
      hasBillingAccess: billing.hasAccess,
      onboardingCompletedAt: tenant?.onboarding_completed_at
        ? new Date(tenant.onboarding_completed_at).toISOString()
        : null,
    },
  };
}

async function buildAuthPayloadWithQuota(user, tenant) {
  const payload = buildAuthPayload(user, tenant);
  payload.user.quota = await getQuotaUsage(prisma, tenant);
  return payload;
}

export class AuthService {
  static async ensureBootstrapAdmin() {
    const tenant = await ensureSeedTenant();

    const count = await prisma.users.count({
      where: { tenant_id: tenant.id },
    });
    if (count > 0) return;

    const email = (
      process.env.ADMIN_EMAIL || DEFAULT_BOOTSTRAP.email
    ).toLowerCase();
    const password = process.env.ADMIN_PASSWORD || DEFAULT_BOOTSTRAP.password;
    const nome = process.env.ADMIN_NOME || DEFAULT_BOOTSTRAP.nome;

    await prisma.users.create({
      data: {
        tenant_id: tenant.id,
        email,
        nome,
        role: "admin",
        password_hash: await hashPassword(password),
        ativo: true,
      },
    });

    logger.warn("Usuário administrador inicial criado", {
      email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      hint: "Defina ADMIN_EMAIL e ADMIN_PASSWORD em produção e troque a senha após o primeiro login.",
    });
  }

  /**
   * Cadastro público: nova empresa (tenant) + admin.
   * Novos tenants entram em trial (billing_exempt=false).
   */
  static async register({ empresaNome, email, password, nome }) {
    if (process.env.ALLOW_PUBLIC_REGISTER === "false") {
      const err = new Error("Cadastro de novas empresas está desabilitado");
      err.statusCode = 403;
      throw err;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const empresa = String(empresaNome).trim();
    const nomeAdmin = String(nome || "").trim() || "Administrador";

    const existingUser = await prisma.users.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      const err = new Error(
        "Já existe uma conta com este e-mail. Faça login ou use outro e-mail.",
      );
      err.statusCode = 409;
      throw err;
    }

    const password_hash = await hashPassword(password);
    const baseSlug = slugifyTenantName(empresa);
    const billingDefaults = newTenantBillingDefaults(config.billing.trialDays);

    const legalStamp = {
      legal_version: LEGAL_VERSION,
      legal_accepted_at: new Date(),
    };

    const { tenant, user } = await prisma.$transaction(async (tx) => {
      const slug = await allocateUniqueSlug(baseSlug, tx);
      const createdTenant = await tx.tenants.create({
        data: {
          nome: empresa,
          slug,
          ativo: true,
          ...billingDefaults,
          ...legalStamp,
        },
      });

      const createdUser = await tx.users.create({
        data: {
          tenant_id: createdTenant.id,
          email: normalizedEmail,
          nome: nomeAdmin,
          role: "admin",
          password_hash,
          ativo: true,
          ...legalStamp,
        },
      });

      return { tenant: createdTenant, user: createdUser };
    });

    logger.info("Nova empresa cadastrada", {
      tenantId: tenant.id,
      slug: tenant.slug,
      email: user.email,
      plan: tenant.plan,
      trialEndsAt: tenant.trial_ends_at,
    });

    return buildAuthPayloadWithQuota(user, tenant);
  }

  static async login({ email, password }) {
    await this.ensureBootstrapAdmin();

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.users.findUnique({
      where: { email: normalizedEmail },
      include: {
        tenants: {
          select: TENANT_BILLING_SELECT,
        },
      },
    });

    if (!user?.ativo) {
      const err = new Error("Credenciais inválidas");
      err.statusCode = 401;
      throw err;
    }

    if (!user.tenants?.ativo) {
      const err = new Error("Empresa inativa. Contate o suporte.");
      err.statusCode = 401;
      throw err;
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      const err = new Error("Credenciais inválidas");
      err.statusCode = 401;
      throw err;
    }

    return buildAuthPayloadWithQuota(user, user.tenants);
  }

  static async getProfile(userId, contextUser = null) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) {
      return this.getSyntheticProfile(contextUser);
    }

    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nome: true,
        role: true,
        permissions: true,
        ativo: true,
        tenant_id: true,
        tenants: {
          select: TENANT_BILLING_SELECT,
        },
      },
    });

    if (!user?.ativo) {
      const err = new Error("Usuário não encontrado");
      err.statusCode = 404;
      throw err;
    }

    const billing = buildBillingPublic(user.tenants);
    const permissions = resolvePermissions(user.role, user.permissions);

    return {
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role,
      permissions,
      ativo: user.ativo,
      tenantId: user.tenant_id,
      tenantSlug: user.tenants?.slug ?? null,
      tenantNome: user.tenants?.nome ?? null,
      features: billing.features,
      billingExempt: billing.billingExempt,
      plan: billing.plan,
      subscriptionStatus: billing.subscriptionStatus,
      trialEndsAt: billing.trialEndsAt,
      hasBillingAccess: billing.hasAccess,
      onboardingCompletedAt: user.tenants?.onboarding_completed_at
        ? new Date(user.tenants.onboarding_completed_at).toISOString()
        : null,
      quota: await getQuotaUsage(prisma, user.tenants),
    };
  }

  /** AUTH_ENABLED=false / API_TOKEN: id não numérico no context. */
  static async getSyntheticProfile(contextUser) {
    const tenantId = Number(contextUser?.tenantId);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      const err = new Error("Usuário não encontrado");
      err.statusCode = 404;
      throw err;
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: TENANT_BILLING_SELECT,
    });
    if (!tenant) {
      const err = new Error("Usuário não encontrado");
      err.statusCode = 404;
      throw err;
    }

    const billing = buildBillingPublic(tenant);
    const role = contextUser.role || "admin";
    const permissions = Array.isArray(contextUser.permissions) && contextUser.permissions.length
      ? contextUser.permissions
      : resolvePermissions(role);

    return {
      id: contextUser.id,
      email: contextUser.email || "dev@local",
      nome: contextUser.nome || "Desenvolvimento",
      role,
      permissions,
      ativo: true,
      tenantId,
      tenantSlug: tenant.slug ?? null,
      tenantNome: tenant.nome ?? null,
      features: billing.features,
      billingExempt: billing.billingExempt,
      plan: billing.plan,
      subscriptionStatus: billing.subscriptionStatus,
      trialEndsAt: billing.trialEndsAt,
      hasBillingAccess: billing.hasAccess,
      onboardingCompletedAt: tenant.onboarding_completed_at
        ? new Date(tenant.onboarding_completed_at).toISOString()
        : null,
      quota: await getQuotaUsage(prisma, tenant),
    };
  }

  static isJwtConfigured() {
    return Boolean(config.auth.jwtSecret);
  }

  static frontendUrl() {
    return config.billing.frontendUrl;
  }

  static forgotPasswordGenericMessage() {
    return "Se este e-mail estiver cadastrado, enviaremos as instruções em instantes.";
  }

  static async requestPasswordReset(email) {
    const generic = { message: this.forgotPasswordGenericMessage() };
    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.users.findUnique({
      where: { email: normalizedEmail },
      include: {
        tenants: { select: { id: true, nome: true, ativo: true } },
      },
    });

    if (!user?.ativo || !user.tenants?.ativo) {
      return generic;
    }

    if (!isMailConfigured()) {
      logger.warn("Pedido de reset de senha ignorado: SMTP não configurado", {
        userId: user.id,
      });
      return generic;
    }

    await prisma.auth_tokens.updateMany({
      where: {
        purpose: AUTH_TOKEN_PURPOSE.RESET,
        user_id: user.id,
        used_at: null,
      },
      data: { used_at: new Date() },
    });

    const { raw, hash } = generateAuthToken();
    await prisma.auth_tokens.create({
      data: {
        purpose: AUTH_TOKEN_PURPOSE.RESET,
        email: user.email,
        tenant_id: user.tenant_id,
        user_id: user.id,
        token_hash: hash,
        expires_at: new Date(Date.now() + AUTH_TOKEN_TTL.RESET_MS),
      },
    });

    const link = `${this.frontendUrl()}/reset-senha?token=${encodeURIComponent(raw)}`;
    const nome = user.nome || "olá";
    try {
      await sendMail({
        to: user.email,
        subject: "Redefinir senha — ATrack",
        text: `${nome}, use este link para definir uma nova senha (válido por 1 hora):\n\n${link}\n\nSe você não pediu isso, ignore este e-mail.`,
        html: `<p>${escapeHtml(nome)}, use o link abaixo para definir uma nova senha. Ele vale por <strong>1 hora</strong>.</p><p><a href="${escapeHtml(link)}">Redefinir senha</a></p><p>Se você não pediu isso, ignore este e-mail.</p>`,
      });
    } catch (err) {
      logger.error("Falha ao enviar e-mail de reset de senha", err);
    }

    return generic;
  }

  static async resetPassword(token, password) {
    const row = await this.findUsableToken(token, AUTH_TOKEN_PURPOSE.RESET);
    if (!row?.user_id) {
      const err = new Error("Este link expirou ou já foi usado. Solicite um novo.");
      err.statusCode = 400;
      throw err;
    }

    const user = await prisma.users.findFirst({
      where: { id: row.user_id, ativo: true },
    });
    if (!user) {
      const err = new Error("Usuário não encontrado");
      err.statusCode = 404;
      throw err;
    }

    await prisma.$transaction([
      prisma.users.update({
        where: { id: user.id },
        data: { password_hash: await hashPassword(password) },
      }),
      prisma.auth_tokens.update({
        where: { id: row.id },
        data: { used_at: new Date() },
      }),
    ]);

    logger.info("Senha redefinida via e-mail", { userId: user.id });
    return { message: "Senha atualizada. Entre com a nova senha." };
  }

  static async getInvitePreview(token) {
    const row = await this.findUsableToken(token, AUTH_TOKEN_PURPOSE.INVITE);
    if (!row) {
      const err = new Error("Este convite expirou ou já foi usado.");
      err.statusCode = 400;
      throw err;
    }

    const tenant = row.tenant_id
      ? await prisma.tenants.findUnique({
          where: { id: row.tenant_id },
          select: { nome: true, ativo: true },
        })
      : null;

    if (!tenant?.ativo) {
      const err = new Error("Este convite não é mais válido.");
      err.statusCode = 400;
      throw err;
    }

    return {
      email: row.email,
      nome: row.nome,
      role: row.role,
      empresaNome: tenant.nome,
      expiresAt: row.expires_at,
    };
  }

  static async acceptInvite({ token, password, nome }) {
    const row = await this.findUsableToken(token, AUTH_TOKEN_PURPOSE.INVITE);
    if (!row?.tenant_id) {
      const err = new Error("Este convite expirou ou já foi usado.");
      err.statusCode = 400;
      throw err;
    }

    const existing = await prisma.users.findUnique({
      where: { email: row.email },
    });
    if (existing) {
      const err = new Error(
        "Já existe uma conta com este e-mail. Faça login ou recupere a senha.",
      );
      err.statusCode = 409;
      throw err;
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: row.tenant_id },
      select: TENANT_BILLING_SELECT,
    });
    if (!tenant?.ativo) {
      const err = new Error("A empresa deste convite está inativa.");
      err.statusCode = 400;
      throw err;
    }

    await assertCanAddUserSeat(prisma, tenant, { convertingInvite: true });

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.users.create({
        data: {
          tenant_id: row.tenant_id,
          email: row.email,
          nome: String(nome || row.nome || "").trim() || "Usuário",
          role: row.role || "operator",
          password_hash: await hashPassword(password),
          ativo: true,
          legal_version: LEGAL_VERSION,
          legal_accepted_at: new Date(),
        },
      });
      await tx.auth_tokens.update({
        where: { id: row.id },
        data: { used_at: new Date() },
      });
      return created;
    });

    logger.info("Convite aceito", {
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
    });

    return buildAuthPayloadWithQuota(user, tenant);
  }

  static async changePassword(userId, { currentPassword, newPassword }) {
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) {
      const err = new Error(
        "Esta sessão não permite alterar senha. Entre com um usuário real.",
      );
      err.statusCode = 400;
      throw err;
    }

    const user = await prisma.users.findUnique({
      where: { id },
      select: { id: true, password_hash: true, ativo: true },
    });
    if (!user?.ativo) {
      const err = new Error("Usuário não encontrado");
      err.statusCode = 404;
      throw err;
    }

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      const err = new Error("Senha atual incorreta");
      err.statusCode = 400;
      throw err;
    }

    if (currentPassword === newPassword) {
      const err = new Error("A nova senha deve ser diferente da atual");
      err.statusCode = 400;
      throw err;
    }

    await prisma.users.update({
      where: { id },
      data: { password_hash: await hashPassword(newPassword) },
    });

    logger.info("Senha alterada pelo próprio usuário", { userId: id });
    return { message: "Senha atualizada com sucesso" };
  }

  static async findUsableToken(rawToken, purpose) {
    const hash = hashAuthToken(rawToken);
    if (!hash) return null;
    const row = await prisma.auth_tokens.findUnique({
      where: { token_hash: hash },
    });
    if (!isAuthTokenUsable(row, purpose)) return null;
    return row;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
