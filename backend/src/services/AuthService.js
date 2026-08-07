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

    const { tenant, user } = await prisma.$transaction(async (tx) => {
      const slug = await allocateUniqueSlug(baseSlug, tx);
      const createdTenant = await tx.tenants.create({
        data: {
          nome: empresa,
          slug,
          ativo: true,
          ...billingDefaults,
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

    return buildAuthPayload(user, tenant);
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

    return buildAuthPayload(user, user.tenants);
  }

  static async getProfile(userId) {
    const user = await prisma.users.findUnique({
      where: { id: Number(userId) },
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
      throw new Error("Usuário não encontrado");
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
    };
  }

  static isJwtConfigured() {
    return Boolean(config.auth.jwtSecret);
  }
}
