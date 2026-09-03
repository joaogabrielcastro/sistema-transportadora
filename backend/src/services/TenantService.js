import prisma from "../lib/prisma.js";
import { logger } from "../utils/logger.js";
import { getQuotaUsage } from "../utils/planQuotas.js";
import { AUTH_TOKEN_PURPOSE } from "../utils/authTokens.js";
import { BillingService } from "./BillingService.js";
import { confirmNameMatches } from "../schemas/tenantSchema.js";

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function toPublicSettings(tenant, quota) {
  return {
    nome: tenant.nome,
    slug: tenant.slug,
    criadoEm: tenant.criado_em,
    alertEmail: tenant.alert_email,
    whatsappNotifyPhone: tenant.whatsapp_notify_phone,
    weeklyDigestEnabled: tenant.weekly_digest_enabled,
    plan: tenant.plan,
    subscriptionStatus: tenant.subscription_status,
    billingExempt: tenant.billing_exempt,
    trialEndsAt: tenant.trial_ends_at,
    ativo: tenant.ativo,
    canClose: tenant.ativo === true && tenant.billing_exempt !== true,
    quota,
  };
}

export class TenantService {
  static async getSettings(tenantId) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: Number(tenantId) },
    });
    if (!tenant) {
      throw httpError("Empresa não encontrada", 404);
    }
    const quota = await getQuotaUsage(prisma, tenant);
    return toPublicSettings(tenant, quota);
  }

  static async updateSettings(tenantId, body = {}) {
    const data = {};
    if (body.nome !== undefined) {
      data.nome = String(body.nome).trim();
    }
    if (body.alertEmail !== undefined) {
      const email = String(body.alertEmail || "").trim();
      data.alert_email = email || null;
    }
    if (body.whatsappNotifyPhone !== undefined) {
      const phone = String(body.whatsappNotifyPhone || "").trim();
      data.whatsapp_notify_phone = phone || null;
    }
    if (typeof body.weeklyDigestEnabled === "boolean") {
      data.weekly_digest_enabled = body.weeklyDigestEnabled;
    }

    if (Object.keys(data).length) {
      await prisma.tenants.update({
        where: { id: Number(tenantId) },
        data,
      });
    }

    return this.getSettings(tenantId);
  }

  static assertCanClose(tenant, confirmName) {
    if (!tenant) {
      throw httpError("Empresa não encontrada", 404);
    }
    if (tenant.ativo === false) {
      throw httpError("Esta empresa já está encerrada.", 400);
    }
    if (tenant.billing_exempt === true) {
      throw httpError(
        "Contas isentas de cobrança não podem ser encerradas por aqui. Fale com o suporte.",
        400,
      );
    }
    if (!confirmNameMatches(tenant.nome, confirmName)) {
      throw httpError(
        "Digite o nome da empresa exatamente como aparece para confirmar.",
        400,
      );
    }
  }

  /**
   * Encerra a empresa: desativa tenant e usuários, invalida convites,
   * tenta cancelar a assinatura Stripe. Não apaga a frota.
   */
  static async closeAccount(tenantId, { confirmName, actorUserId }) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: Number(tenantId) },
    });
    this.assertCanClose(tenant, confirmName);

    const stripe = await BillingService.cancelSubscriptionIfAny(tenant);

    await prisma.$transaction(async (tx) => {
      await tx.tenants.update({
        where: { id: tenant.id },
        data: {
          ativo: false,
          subscription_status: "canceled",
        },
      });
      await tx.users.updateMany({
        where: { tenant_id: tenant.id, ativo: true },
        data: { ativo: false },
      });
      await tx.auth_tokens.updateMany({
        where: {
          tenant_id: tenant.id,
          purpose: AUTH_TOKEN_PURPOSE.INVITE,
          used_at: null,
        },
        data: { used_at: new Date() },
      });
    });

    logger.warn("Empresa encerrada pelo administrador", {
      tenantId: tenant.id,
      slug: tenant.slug,
      by: actorUserId,
      stripeCanceled: stripe?.canceled === true,
    });

    return {
      closed: true,
      stripeCanceled: stripe?.canceled === true,
    };
  }
}
