import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveTenantFeatures,
  defaultFeaturesForSlug,
  ABROTTO_FEATURES,
  DEFAULT_TENANT_FEATURES,
  TRANS_MOTIN_FEATURES,
  featuresForPlan,
  hasActiveSubscriptionAccess,
  buildBillingPublic,
  newTenantBillingDefaults,
  PLAN_FEATURES,
  isPublicBillingPlan,
} from "../../src/utils/tenantFeatures.js";
import {
  mapStripeSubscriptionStatus,
  planForPriceId,
  priceIdForPlan,
} from "../../src/services/BillingService.js";

describe("tenantFeatures", () => {
  it("default abbroto: OC on, notas off", () => {
    assert.deepEqual(defaultFeaturesForSlug("abbroto"), ABROTTO_FEATURES);
    assert.equal(ABROTTO_FEATURES.ordem_coleta, true);
    assert.equal(ABROTTO_FEATURES.notas_estoque, false);
  });

  it("default trans-motin: OC off, notas on", () => {
    assert.deepEqual(defaultFeaturesForSlug("trans-motin"), TRANS_MOTIN_FEATURES);
    assert.equal(TRANS_MOTIN_FEATURES.ordem_coleta, false);
    assert.equal(TRANS_MOTIN_FEATURES.notas_estoque, true);
  });

  it("default genérico: sem módulos premium", () => {
    assert.deepEqual(defaultFeaturesForSlug("outro"), DEFAULT_TENANT_FEATURES);
    assert.equal(DEFAULT_TENANT_FEATURES.ordem_coleta, false);
  });

  it("resolve legado (raw, slug) preenche defaults", () => {
    const motin = resolveTenantFeatures({}, "trans-motin");
    assert.equal(motin.notas_estoque, true);
    assert.equal(motin.ordem_coleta, false);

    const abb = resolveTenantFeatures({}, "abbroto");
    assert.equal(abb.notas_estoque, false);
    assert.equal(abb.ordem_coleta, true);
  });

  it("resolve legado respeita overrides explícitos no abbroto", () => {
    const custom = resolveTenantFeatures(
      { ordem_coleta: false, notas_estoque: true },
      "abbroto",
    );
    assert.equal(custom.ordem_coleta, false);
    assert.equal(custom.notas_estoque, true);
  });

  it("ordem de coleta bloqueada fora do slug abbroto", () => {
    const forcedOff = resolveTenantFeatures({
      billingExempt: false,
      slug: "teste",
      plan: "starter",
      raw: { ordem_coleta: true, notas_estoque: true },
    });
    assert.equal(forcedOff.ordem_coleta, false);
    assert.equal(forcedOff.notas_estoque, true);
  });

  it("billing ativo: features vêm do plano", () => {
    const fiscal = resolveTenantFeatures({
      billingExempt: false,
      slug: "nova",
      plan: "fiscal",
    });
    assert.deepEqual(fiscal, PLAN_FEATURES.fiscal);

    const complete = resolveTenantFeatures({
      billingExempt: false,
      slug: "nova",
      plan: "complete",
      raw: {},
    });
    assert.deepEqual(complete, PLAN_FEATURES.complete);
  });

  it("billing_exempt usa defaults por slug, não o plan", () => {
    const f = resolveTenantFeatures({
      billingExempt: true,
      slug: "trans-motin",
      plan: "ops",
      raw: {},
    });
    assert.equal(f.ordem_coleta, false);
    assert.equal(f.notas_estoque, true);
  });

  it("featuresForPlan: ordem de coleta nunca via plano", () => {
    assert.equal(featuresForPlan("starter").ordem_coleta, false);
    assert.equal(featuresForPlan("ops").ordem_coleta, false);
    assert.equal(featuresForPlan("fiscal").notas_estoque, true);
    assert.equal(featuresForPlan("complete").ordem_coleta, false);
    assert.equal(featuresForPlan("complete").notas_estoque, true);
    assert.equal(featuresForPlan("complete").transporte_fiscal, true);
    assert.equal(featuresForPlan("fiscal").transporte_fiscal, false);
  });

  it("isPublicBillingPlan: starter, fiscal e complete", () => {
    assert.equal(isPublicBillingPlan("starter"), true);
    assert.equal(isPublicBillingPlan("fiscal"), true);
    assert.equal(isPublicBillingPlan("complete"), true);
    assert.equal(isPublicBillingPlan("ops"), false);
  });

  it("hasActiveSubscriptionAccess: exempt sempre ok", () => {
    assert.equal(
      hasActiveSubscriptionAccess({ billing_exempt: true, subscription_status: "none" }),
      true,
    );
  });

  it("hasActiveSubscriptionAccess: trial válido e expirado", () => {
    const future = new Date(Date.now() + 86400000);
    const past = new Date(Date.now() - 86400000);
    assert.equal(
      hasActiveSubscriptionAccess({
        billing_exempt: false,
        subscription_status: "trialing",
        trial_ends_at: future,
      }),
      true,
    );
    assert.equal(
      hasActiveSubscriptionAccess({
        billing_exempt: false,
        subscription_status: "trialing",
        trial_ends_at: past,
      }),
      false,
    );
  });

  it("hasActiveSubscriptionAccess: active e past_due ok; canceled não", () => {
    assert.equal(
      hasActiveSubscriptionAccess({
        billing_exempt: false,
        subscription_status: "active",
      }),
      true,
    );
    assert.equal(
      hasActiveSubscriptionAccess({
        billing_exempt: false,
        subscription_status: "past_due",
      }),
      true,
    );
    assert.equal(
      hasActiveSubscriptionAccess({
        billing_exempt: false,
        subscription_status: "canceled",
      }),
      false,
    );
  });

  it("newTenantBillingDefaults cria trial starter (sem ordem de coleta)", () => {
    const start = new Date("2026-06-01T12:00:00.000Z");
    const d = newTenantBillingDefaults(14, start);
    assert.equal(d.billing_exempt, false);
    assert.equal(d.plan, "starter");
    assert.equal(d.features.ordem_coleta, false);
    assert.equal(d.features.notas_estoque, false);
    assert.equal(d.subscription_status, "trialing");
    const days =
      (d.trial_ends_at.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    assert.ok(days >= 13.9 && days <= 14.1);
  });

  it("buildBillingPublic monta payload fiscal sem ordem de coleta", () => {
    const pub = buildBillingPublic({
      billing_exempt: false,
      plan: "fiscal",
      subscription_status: "trialing",
      trial_ends_at: new Date("2099-01-01"),
      features: {},
      slug: "nova",
    });
    assert.equal(pub.billingExempt, false);
    assert.equal(pub.plan, "fiscal");
    assert.equal(pub.features.ordem_coleta, false);
    assert.equal(pub.features.notas_estoque, true);
    assert.equal(pub.hasAccess, true);
  });
});

describe("BillingService helpers", () => {
  it("mapStripeSubscriptionStatus", () => {
    assert.equal(mapStripeSubscriptionStatus("active"), "active");
    assert.equal(mapStripeSubscriptionStatus("trialing"), "trialing");
    assert.equal(mapStripeSubscriptionStatus("past_due"), "past_due");
    assert.equal(mapStripeSubscriptionStatus("canceled"), "canceled");
    assert.equal(mapStripeSubscriptionStatus("unpaid"), "past_due");
  });

  it("priceIdForPlan / planForPriceId com env", () => {
    const prev = process.env.STRIPE_PRICE_FISCAL;
    process.env.STRIPE_PRICE_FISCAL = "price_fiscal_test";
    try {
      assert.equal(priceIdForPlan("fiscal"), "price_fiscal_test");
      assert.equal(planForPriceId("price_fiscal_test"), "fiscal");
      assert.equal(planForPriceId("price_unknown"), null);
    } finally {
      if (prev === undefined) delete process.env.STRIPE_PRICE_FISCAL;
      else process.env.STRIPE_PRICE_FISCAL = prev;
    }
  });
});
