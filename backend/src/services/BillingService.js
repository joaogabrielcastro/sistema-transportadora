import Stripe from "stripe";
import prisma from "../lib/prisma.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import {
  buildBillingPublic,
  featuresForPlan,
  isPublicBillingPlan,
  isValidPlan,
  PLANS,
} from "../utils/tenantFeatures.js";
import { buildPlansPublic } from "../utils/planCatalog.js";
import { getQuotaUsage } from "../utils/planQuotas.js";

let stripeClient = null;

export function getStripe() {
  if (!config.billing.enabled) {
    const err = new Error(
      "Stripe não configurado. Defina STRIPE_SECRET_KEY no ambiente.",
    );
    err.statusCode = 503;
    throw err;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(config.billing.stripeSecretKey);
  }
  return stripeClient;
}

/** @param {string} plan */
export function priceIdForPlan(plan) {
  if (!isValidPlan(plan)) return null;
  const id = config.billing.prices[plan];
  return id || null;
}

/** @param {string | null | undefined} priceId */
export function planForPriceId(priceId) {
  if (!priceId) return null;
  const prices = config.billing.prices;
  for (const plan of Object.keys(PLANS)) {
    if (prices[plan] && prices[plan] === priceId) {
      return plan;
    }
  }
  return null;
}

/**
 * Mapeia status Stripe → nosso subscription_status.
 * @param {string | null | undefined} stripeStatus
 */
export function mapStripeSubscriptionStatus(stripeStatus) {
  switch (stripeStatus) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "paused":
      return "none";
    default:
      return "none";
  }
}

export class BillingService {
  static async getStatus(tenantId) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: Number(tenantId) },
    });
    if (!tenant) {
      const err = new Error("Empresa não encontrada");
      err.statusCode = 404;
      throw err;
    }

    const billing = buildBillingPublic(tenant);
    return {
      ...billing,
      quota: await getQuotaUsage(prisma, tenant),
      plans: buildPlansPublic({
        priceConfiguredFor: (key) => Boolean(priceIdForPlan(key)),
      }),
      stripeConfigured: config.billing.enabled,
    };
  }

  static async ensureStripeCustomer(tenant, email) {
    const stripe = getStripe();
    if (tenant.stripe_customer_id) {
      return tenant.stripe_customer_id;
    }

    const customer = await stripe.customers.create({
      email: email || undefined,
      name: tenant.nome,
      metadata: {
        tenantId: String(tenant.id),
        tenantSlug: tenant.slug,
      },
    });

    await prisma.tenants.update({
      where: { id: tenant.id },
      data: { stripe_customer_id: customer.id },
    });

    return customer.id;
  }

  /**
   * @param {{ tenantId: number, plan: string, email?: string }} opts
   */
  static async createCheckoutSession({ tenantId, plan, email }) {
    if (!isValidPlan(plan) || !isPublicBillingPlan(plan)) {
      const err = new Error("Plano inválido ou indisponível para contratação");
      err.statusCode = 400;
      throw err;
    }

    const priceId = priceIdForPlan(plan);
    if (!priceId) {
      const err = new Error(
        `Preço Stripe não configurado para o plano "${plan}". Defina STRIPE_PRICE_${plan.toUpperCase()}.`,
      );
      err.statusCode = 503;
      throw err;
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: Number(tenantId) },
    });
    if (!tenant) {
      const err = new Error("Empresa não encontrada");
      err.statusCode = 404;
      throw err;
    }

    if (tenant.billing_exempt) {
      const err = new Error(
        "Esta empresa está isenta de cobrança e não precisa assinar.",
      );
      err.statusCode = 400;
      throw err;
    }

    const stripe = getStripe();
    const customerId = await this.ensureStripeCustomer(tenant, email);
    const base = config.billing.frontendUrl;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/assinatura?checkout=success`,
      cancel_url: `${base}/assinatura?checkout=cancel`,
      client_reference_id: String(tenant.id),
      metadata: {
        tenantId: String(tenant.id),
        plan,
      },
      subscription_data: {
        metadata: {
          tenantId: String(tenant.id),
          plan,
        },
      },
      allow_promotion_codes: true,
    });

    return { url: session.url, sessionId: session.id };
  }

  static async createPortalSession(tenantId) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: Number(tenantId) },
    });
    if (!tenant) {
      const err = new Error("Empresa não encontrada");
      err.statusCode = 404;
      throw err;
    }

    if (tenant.billing_exempt) {
      const err = new Error("Esta empresa está isenta de cobrança.");
      err.statusCode = 400;
      throw err;
    }

    if (!tenant.stripe_customer_id) {
      const err = new Error(
        "Nenhuma assinatura Stripe encontrada. Escolha um plano primeiro.",
      );
      err.statusCode = 400;
      throw err;
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: `${config.billing.frontendUrl}/assinatura`,
    });

    return { url: session.url };
  }

  /** Best-effort: cancela assinatura Stripe se existir. Não lança. */
  static async cancelSubscriptionIfAny(tenant) {
    if (!tenant?.stripe_subscription_id) {
      return { canceled: false, skipped: true };
    }
    if (!config.billing.enabled) {
      return { canceled: false, skipped: true, reason: "stripe-off" };
    }
    try {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(tenant.stripe_subscription_id);
      return { canceled: true };
    } catch (err) {
      logger.warn("Falha ao cancelar assinatura Stripe ao encerrar empresa", {
        tenantId: tenant.id,
        subscriptionId: tenant.stripe_subscription_id,
        error: err?.message,
      });
      return { canceled: false, error: err?.message };
    }
  }

  /**
   * Atualiza tenant a partir de um Subscription Stripe.
   * @param {import('stripe').Stripe.Subscription} subscription
   */
  static async applySubscription(subscription) {
    const tenantIdRaw =
      subscription.metadata?.tenantId ||
      (typeof subscription.customer === "string"
        ? null
        : null);

    let tenant = null;

    if (tenantIdRaw) {
      tenant = await prisma.tenants.findUnique({
        where: { id: Number(tenantIdRaw) },
      });
    }

    if (!tenant && typeof subscription.customer === "string") {
      tenant = await prisma.tenants.findFirst({
        where: { stripe_customer_id: subscription.customer },
      });
    }

    if (!tenant) {
      logger.warn("Webhook Stripe: tenant não encontrado para subscription", {
        subscriptionId: subscription.id,
        customer: subscription.customer,
        metadata: subscription.metadata,
      });
      return null;
    }

    const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
    const planFromPrice = planForPriceId(priceId);
    const planFromMeta = isValidPlan(subscription.metadata?.plan)
      ? subscription.metadata.plan
      : null;
    const plan = planFromPrice || planFromMeta || tenant.plan || PLANS.starter;
    const status = mapStripeSubscriptionStatus(subscription.status);

    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : tenant.trial_ends_at;

    const updated = await prisma.tenants.update({
      where: { id: tenant.id },
      data: {
        stripe_customer_id:
          typeof subscription.customer === "string"
            ? subscription.customer
            : tenant.stripe_customer_id,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        plan,
        subscription_status: status,
        trial_ends_at: status === "trialing" ? trialEnd : tenant.trial_ends_at,
        features: featuresForPlan(plan),
        billing_exempt: false,
      },
    });

    logger.info("Assinatura Stripe aplicada ao tenant", {
      tenantId: updated.id,
      plan: updated.plan,
      status: updated.subscription_status,
      subscriptionId: subscription.id,
    });

    return updated;
  }

  static async handleCheckoutCompleted(session) {
    const tenantId = Number(
      session.client_reference_id || session.metadata?.tenantId,
    );
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      logger.warn("Checkout completed sem tenantId", { sessionId: session.id });
      return null;
    }

    const stripe = getStripe();
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

    if (!subscriptionId) {
      const plan = isValidPlan(session.metadata?.plan)
        ? session.metadata.plan
        : PLANS.starter;
      return prisma.tenants.update({
        where: { id: tenantId },
        data: {
          stripe_customer_id:
            typeof session.customer === "string" ? session.customer : undefined,
          plan,
          subscription_status: "active",
          features: featuresForPlan(plan),
          billing_exempt: false,
        },
      });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (!subscription.metadata?.tenantId) {
      await stripe.subscriptions.update(subscriptionId, {
        metadata: {
          ...subscription.metadata,
          tenantId: String(tenantId),
          plan: session.metadata?.plan || subscription.metadata?.plan || "",
        },
      });
      subscription.metadata = {
        ...subscription.metadata,
        tenantId: String(tenantId),
        plan: session.metadata?.plan || subscription.metadata?.plan || "",
      };
    }

    return this.applySubscription(subscription);
  }

  static async handleSubscriptionDeleted(subscription) {
    const updated = await this.applySubscription({
      ...subscription,
      status: "canceled",
    });
    if (updated) {
      await prisma.tenants.update({
        where: { id: updated.id },
        data: {
          subscription_status: "canceled",
          stripe_subscription_id: null,
        },
      });
    }
    return updated;
  }

  /**
   * @param {Buffer} rawBody
   * @param {string} signature
   */
  static async handleWebhook(rawBody, signature) {
    const stripe = getStripe();
    const secret = config.billing.stripeWebhookSecret;
    if (!secret) {
      const err = new Error("STRIPE_WEBHOOK_SECRET não configurado");
      err.statusCode = 503;
      throw err;
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      const e = new Error(`Webhook Stripe inválido: ${err.message}`);
      e.statusCode = 400;
      throw e;
    }

    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await this.applySubscription(event.data.object);
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await this.applySubscription(sub);
        }
        break;
      }
      default:
        logger.info("Webhook Stripe ignorado", { type: event.type });
    }

    return { received: true, type: event.type };
  }

  /**
   * Admin: togglear billing_exempt / plan.
   * @param {{ tenantId?: number, slug?: string, billingExempt?: boolean, plan?: string | null }} opts
   */
  static async adminUpdateTenantBilling(opts) {
    const where = opts.tenantId
      ? { id: Number(opts.tenantId) }
      : opts.slug
        ? { slug: String(opts.slug).trim().toLowerCase() }
        : null;

    if (!where) {
      const err = new Error("Informe tenantId ou slug");
      err.statusCode = 400;
      throw err;
    }

    const existing = await prisma.tenants.findUnique({ where });
    if (!existing) {
      const err = new Error("Empresa não encontrada");
      err.statusCode = 404;
      throw err;
    }

    const data = {};
    if (typeof opts.billingExempt === "boolean") {
      data.billing_exempt = opts.billingExempt;
      if (opts.billingExempt) {
        data.subscription_status = "active";
      } else if (
        !existing.subscription_status ||
        existing.subscription_status === "active"
      ) {
        // Ao ativar cobrança em legado sem Stripe: força trial curto se ainda não tem sub
        if (!existing.stripe_subscription_id) {
          const trialEnds = new Date();
          trialEnds.setDate(trialEnds.getDate() + config.billing.trialDays);
          data.subscription_status = "trialing";
          data.trial_ends_at = trialEnds;
          data.plan = existing.plan || PLANS.starter;
          data.features = featuresForPlan(existing.plan || PLANS.starter);
        }
      }
    }

    if (opts.plan !== undefined) {
      if (opts.plan === null || opts.plan === "") {
        data.plan = null;
      } else if (isValidPlan(opts.plan)) {
        data.plan = opts.plan;
        data.features = featuresForPlan(opts.plan);
      } else {
        const err = new Error("Plano inválido");
        err.statusCode = 400;
        throw err;
      }
    }

    const updated = await prisma.tenants.update({
      where: { id: existing.id },
      data,
    });

    return buildBillingPublic(updated);
  }
}
