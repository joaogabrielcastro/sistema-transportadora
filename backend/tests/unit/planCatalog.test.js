import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_CATALOG,
  PLAN_UNAVAILABLE_MESSAGE,
  buildPlansPublic,
  lidForPlan,
  resolvePublicPlanByLid,
} from "../../src/utils/planCatalog.js";
import { PUBLIC_BILLING_PLANS } from "../../src/utils/tenantFeatures.js";
import { BillingService } from "../../src/services/BillingService.js";

describe("planCatalog LID", () => {
  it("LID público é o id do catálogo, não o nome comercial", () => {
    for (const plan of PLAN_CATALOG) {
      assert.equal(lidForPlan(plan.id), plan.id);
      assert.notEqual(lidForPlan(plan.id), plan.name);
    }
  });

  it("plano público gera LID correto", () => {
    assert.equal(resolvePublicPlanByLid("starter").lid, "starter");
    assert.equal(resolvePublicPlanByLid("FISCAL").lid, "fiscal");
    assert.equal(resolvePublicPlanByLid(" complete ").plan.id, "complete");
  });

  it("plano inexistente é rejeitado", () => {
    const missing = resolvePublicPlanByLid("profissional");
    assert.equal(missing.ok, false);
    assert.equal(missing.code, "LID_INVALID");
    assert.equal(missing.message, PLAN_UNAVAILABLE_MESSAGE);
  });

  it("plano legado ops não é vendável", () => {
    const ops = resolvePublicPlanByLid("ops");
    assert.equal(ops.ok, false);
    assert.equal(ops.code, "LID_INVALID");
  });

  it("LID vazio é rejeitado", () => {
    const empty = resolvePublicPlanByLid("  ");
    assert.equal(empty.ok, false);
    assert.equal(empty.code, "LID_MISSING");
  });

  it("catálogo público expõe lid e não inventa planos", () => {
    const plans = buildPlansPublic({ priceConfiguredFor: () => false });
    assert.deepEqual(
      plans.map((p) => p.lid),
      [...PUBLIC_BILLING_PLANS],
    );
    for (const plan of plans) {
      assert.equal(plan.lid, plan.id);
      assert.equal(plan.available, true);
      assert.ok(Array.isArray(plan.highlights));
      assert.ok(plan.priceMonthlyBrl > 0);
    }
  });

  it("checkout rejeita LID inválido antes de falar com o Stripe", async () => {
    await assert.rejects(
      () =>
        BillingService.createCheckoutSession({
          tenantId: 1,
          lid: "profissional",
        }),
      (err) =>
        err.code === "LID_INVALID" &&
        err.statusCode === 400 &&
        err.message === PLAN_UNAVAILABLE_MESSAGE,
    );
  });
});
