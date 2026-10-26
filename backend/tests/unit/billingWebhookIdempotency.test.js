/**
 * Contratos de idempotência / segurança do webhook Stripe.
 * (Não há tabela de event_id; replay depende de updates idempotentes no tenant.)
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const billingSrc = readFileSync(
  new URL("../../src/services/BillingService.js", import.meta.url),
  "utf8",
);

test("mapa de status Stripe é estável sob repetição (contrato)", async () => {
  const { mapStripeSubscriptionStatus } = await import(
    "../../src/services/BillingService.js"
  );

  assert.equal(mapStripeSubscriptionStatus("active"), "active");
  assert.equal(mapStripeSubscriptionStatus("active"), "active");
  assert.equal(mapStripeSubscriptionStatus("trialing"), "trialing");
  assert.equal(mapStripeSubscriptionStatus("past_due"), "past_due");
  assert.equal(mapStripeSubscriptionStatus("canceled"), "canceled");
  assert.equal(mapStripeSubscriptionStatus("incomplete"), "none");
});

test("documenta ausência de dedupe por event.id no webhook", () => {
  assert.match(billingSrc, /handleWebhook/);
  assert.doesNotMatch(
    billingSrc,
    /stripe_events|processed_events|event\.id.*unique/i,
    "não há ledger de event.id — replay depende de updates idempotentes no tenant",
  );
  assert.match(billingSrc, /applySubscription|handleCheckoutCompleted/);
});

test("checkout.session.completed sem subscription_id não ativa assinatura", () => {
  assert.match(
    billingSrc,
    /Checkout completed sem subscription_id — assinatura não ativada/,
  );
  // Não deve mais haver o atalho que gravava subscription_status: "active" sem sub.
  const checkoutFn = billingSrc.slice(
    billingSrc.indexOf("static async handleCheckoutCompleted"),
    billingSrc.indexOf("static async handleSubscriptionDeleted"),
  );
  assert.doesNotMatch(
    checkoutFn,
    /subscription_status:\s*["']active["']/,
    "sem subscription_id o checkout não deve forçar active",
  );
  assert.match(checkoutFn, /return null/);
});

test("ordem de eventos: deleted limpa subscription_id após apply", () => {
  const deletedFn = billingSrc.slice(
    billingSrc.indexOf("static async handleSubscriptionDeleted"),
    billingSrc.indexOf("static async handleWebhook"),
  );
  assert.match(deletedFn, /subscription_status:\s*["']canceled["']/);
  assert.match(deletedFn, /stripe_subscription_id:\s*null/);
});
