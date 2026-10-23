/**
 * Repetir applySubscription / checkout sem subscription_id não deve
 * “duplicar” estado — apenas regrava os mesmos campos do tenant.
 * (Não há tabela de event_id do Stripe; idempotência é por upsert de campos.)
 */
import test from "node:test";
import assert from "node:assert/strict";

test("mapa de status Stripe é estável sob repetição (contrato)", async () => {
  const { mapStripeSubscriptionStatus } = await import(
    "../../src/services/BillingService.js"
  );

  assert.equal(mapStripeSubscriptionStatus("active"), "active");
  assert.equal(mapStripeSubscriptionStatus("active"), "active");
  assert.equal(mapStripeSubscriptionStatus("trialing"), "trialing");
});

test("documenta ausência de dedupe por event.id no webhook", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(
    new URL("../../src/services/BillingService.js", import.meta.url),
    "utf8",
  );
  assert.match(src, /handleWebhook/);
  assert.doesNotMatch(
    src,
    /stripe_events|processed_events|event\.id.*unique/i,
    "não há ledger de event.id — replay depende de updates idempotentes no tenant",
  );
  assert.match(src, /applySubscription|handleCheckoutCompleted/);
});
