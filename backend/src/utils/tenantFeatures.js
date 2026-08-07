/** Feature flags e planos por tenant (menu/módulos). */

export const PLANS = Object.freeze({
  starter: "starter",
  ops: "ops",
  fiscal: "fiscal",
  complete: "complete",
});

export const PLAN_FEATURES = Object.freeze({
  starter: Object.freeze({ ordem_coleta: false, notas_estoque: false }),
  ops: Object.freeze({ ordem_coleta: true, notas_estoque: false }),
  fiscal: Object.freeze({ ordem_coleta: false, notas_estoque: true }),
  complete: Object.freeze({ ordem_coleta: true, notas_estoque: true }),
});

export const DEFAULT_TENANT_FEATURES = Object.freeze({
  ordem_coleta: true,
  notas_estoque: false,
});

export const TRANS_MOTIN_FEATURES = Object.freeze({
  ordem_coleta: false,
  notas_estoque: true,
});

export const TRANS_MOTIN_SLUG = "trans-motin";

export const DEFAULT_TRIAL_PLAN = PLANS.ops;

/**
 * @param {unknown} plan
 * @returns {plan is keyof typeof PLAN_FEATURES}
 */
export function isValidPlan(plan) {
  return typeof plan === "string" && Object.prototype.hasOwnProperty.call(PLAN_FEATURES, plan);
}

/**
 * Features base de um plano pago.
 * @param {string | null | undefined} plan
 */
export function featuresForPlan(plan) {
  if (isValidPlan(plan)) {
    return { ...PLAN_FEATURES[plan] };
  }
  return { ...PLAN_FEATURES.ops };
}

/**
 * Defaults legados por slug (só para billing_exempt).
 * @param {string | null | undefined} slug
 */
export function defaultFeaturesForSlug(slug) {
  return slug === TRANS_MOTIN_SLUG
    ? { ...TRANS_MOTIN_FEATURES }
    : { ...DEFAULT_TENANT_FEATURES };
}

/**
 * Mescla overrides booleanos do JSON sobre uma base.
 * @param {Record<string, boolean>} base
 * @param {unknown} raw
 */
function mergeFeatureOverrides(base, raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...base };
  }

  return {
    ordem_coleta:
      typeof raw.ordem_coleta === "boolean" ? raw.ordem_coleta : base.ordem_coleta,
    notas_estoque:
      typeof raw.notas_estoque === "boolean"
        ? raw.notas_estoque
        : base.notas_estoque,
  };
}

/**
 * Resolve features efetivas do tenant.
 *
 * - billing_exempt: JSON + defaults por slug (comportamento legado)
 * - billing ativo: features do `plan`, com overrides opcionais no JSON
 *
 * @param {object} opts
 * @param {unknown} [opts.raw] features JSON do banco
 * @param {string | null | undefined} [opts.slug]
 * @param {boolean} [opts.billingExempt]
 * @param {string | null | undefined} [opts.plan]
 */
export function resolveTenantFeatures(opts = {}) {
  // Compat: resolveTenantFeatures(raw, slug) — testes e código legado
  if (
    arguments.length >= 1 &&
    (typeof opts !== "object" ||
      opts === null ||
      Array.isArray(opts) ||
      arguments.length === 2)
  ) {
    const raw = arguments[0];
    const slug = arguments[1];
    return mergeFeatureOverrides(defaultFeaturesForSlug(slug), raw);
  }

  const {
    raw,
    slug,
    billingExempt = true,
    plan = null,
  } = opts;

  if (billingExempt) {
    return mergeFeatureOverrides(defaultFeaturesForSlug(slug), raw);
  }

  return mergeFeatureOverrides(featuresForPlan(plan), raw);
}

/**
 * Assinatura permite uso do app?
 * @param {object} tenant
 * @param {Date} [now]
 */
export function hasActiveSubscriptionAccess(tenant, now = new Date()) {
  if (!tenant) return false;
  if (tenant.billing_exempt === true || tenant.billingExempt === true) {
    return true;
  }

  const status =
    tenant.subscription_status ?? tenant.subscriptionStatus ?? "none";

  if (status === "active") return true;

  if (status === "trialing") {
    const ends = tenant.trial_ends_at ?? tenant.trialEndsAt;
    if (!ends) return true;
    const endDate = ends instanceof Date ? ends : new Date(ends);
    return endDate.getTime() > now.getTime();
  }

  // past_due: ainda permite acesso (grace até webhook cancelar)
  if (status === "past_due") return true;

  return false;
}

/**
 * Payload de billing para auth/me e login.
 * @param {object | null | undefined} tenant
 */
export function buildBillingPublic(tenant) {
  if (!tenant) {
    return {
      billingExempt: true,
      plan: null,
      subscriptionStatus: null,
      trialEndsAt: null,
      features: resolveTenantFeatures({ billingExempt: true }),
    };
  }

  const billingExempt = Boolean(tenant.billing_exempt);
  const plan = tenant.plan ?? null;
  const features = resolveTenantFeatures({
    raw: tenant.features,
    slug: tenant.slug,
    billingExempt,
    plan,
  });

  return {
    billingExempt,
    plan,
    subscriptionStatus: tenant.subscription_status ?? null,
    trialEndsAt: tenant.trial_ends_at
      ? new Date(tenant.trial_ends_at).toISOString()
      : null,
    features,
    hasAccess: hasActiveSubscriptionAccess(tenant),
  };
}

/**
 * Dados iniciais de billing para novo tenant cobrado.
 * @param {number} trialDays
 * @param {Date} [now]
 */
export function newTenantBillingDefaults(trialDays = 14, now = new Date()) {
  const trialEnds = new Date(now);
  trialEnds.setDate(trialEnds.getDate() + trialDays);
  return {
    billing_exempt: false,
    plan: DEFAULT_TRIAL_PLAN,
    subscription_status: "trialing",
    trial_ends_at: trialEnds,
    features: featuresForPlan(DEFAULT_TRIAL_PLAN),
  };
}

/**
 * Dados para tenant isento (legado / CLI --exempt).
 * @param {string} slug
 */
export function exemptTenantBillingDefaults(slug) {
  return {
    billing_exempt: true,
    plan: null,
    subscription_status: "active",
    trial_ends_at: null,
    features: defaultFeaturesForSlug(slug),
  };
}
