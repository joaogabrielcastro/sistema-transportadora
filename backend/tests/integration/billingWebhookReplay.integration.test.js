/**
 * Replay de applySubscription: mesmo subscription_id aplicado 2x não cria
 * tenants extras nem altera contagem — só regrava campos.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { shouldRunDbTests } from "../helpers/env/jwtAuthDb.js";
import prisma from "../../src/lib/prisma.js";
import { BillingService } from "../../src/services/BillingService.js";
import { cleanupTenant } from "../helpers/dbTestFixtures.js";
import { newTenantBillingDefaults } from "../../src/utils/tenantFeatures.js";

test(
  "applySubscription repetido é idempotente no tenant",
  { skip: shouldRunDbTests ? false : "Defina RUN_DB_TESTS=1" },
  async () => {
    const stamp = Date.now().toString(36);
    const tenant = await prisma.tenants.create({
      data: {
        nome: `Webhook Replay ${stamp}`,
        slug: `wh-replay-${stamp}`,
        ativo: true,
        ...newTenantBillingDefaults(15),
      },
    });

    const subscription = {
      id: `sub_test_${stamp}`,
      customer: `cus_test_${stamp}`,
      status: "active",
      metadata: { tenantId: String(tenant.id), plan: "starter" },
      items: { data: [{ price: { id: "price_test_starter" } }] },
      trial_end: null,
    };

    try {
      const first = await BillingService.applySubscription(subscription);
      assert.ok(first);
      assert.equal(first.subscription_status, "active");
      assert.equal(first.stripe_subscription_id, subscription.id);

      const second = await BillingService.applySubscription(subscription);
      assert.ok(second);
      assert.equal(second.id, first.id);
      assert.equal(second.stripe_subscription_id, subscription.id);
      assert.equal(second.subscription_status, "active");

      const count = await prisma.tenants.count({
        where: { stripe_subscription_id: subscription.id },
      });
      assert.equal(count, 1, "replay não deve duplicar vínculo de subscription");
    } finally {
      await cleanupTenant(tenant.id);
    }
  },
);
