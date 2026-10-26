#!/usr/bin/env node
/**
 * Probe seguro (Stripe TEST): cadastro throwaway → checkout-session →
 * assinatura test com PM de teste → webhooks assinados → status → replay → cancel.
 *
 * Requer env (não loga secrets):
 *   STRIPE_SECRET_KEY=sk_test_...
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 *   STRIPE_PRICE_STARTER=price_...
 *
 * Uso:
 *   node scripts/stripe-starter-checkout-probe.mjs
 */
import Stripe from "stripe";

const API = (
  process.env.ATRACK_API_URL || "https://api-abbroto.jwsoftware.com.br"
).replace(/\/$/, "");
const sk = (process.env.STRIPE_SECRET_KEY || "").trim();
const whsec = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
const priceStarter = (process.env.STRIPE_PRICE_STARTER || "").trim();

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (!sk.startsWith("sk_test_")) fail("STRIPE_SECRET_KEY deve ser sk_test_…");
if (!whsec.startsWith("whsec_")) fail("STRIPE_WEBHOOK_SECRET ausente/inválido");
if (!priceStarter.startsWith("price_")) fail("STRIPE_PRICE_STARTER ausente");

const stripe = new Stripe(sk);
const stamp = Date.now().toString(36);
const email = `atrack.probe.${stamp}@example.com`;
const password = `Probe-${stamp}-Aa1`;
const empresaNome = `Probe Stripe ${stamp}`;

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function postSignedWebhook(type, object) {
  const event = {
    id: `evt_probe_${stamp}_${type.replace(/\./g, "_")}_${Math.random().toString(36).slice(2, 8)}`,
    object: "event",
    api_version: "2024-11-20.acacia",
    created: Math.floor(Date.now() / 1000),
    type,
    data: { object },
  };
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: whsec,
  });
  const res = await fetch(`${API}/api/billing/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": signature,
    },
    body: payload,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json, eventId: event.id };
}

console.log("API:", API);
console.log("1) Register throwaway tenant…");
const reg = await api("/api/auth/register", {
  method: "POST",
  body: {
    empresaNome,
    nome: "Probe Starter",
    email,
    password,
    acceptedLegal: true,
    lid: "starter",
  },
});
if (reg.status !== 200 && reg.status !== 201) {
  fail(`register ${reg.status}: ${JSON.stringify(reg.json)}`);
}

console.log("2) Login…");
const login = await api("/api/auth/login", {
  method: "POST",
  body: { email, password },
});
if (login.status !== 200) fail(`login ${login.status}: ${JSON.stringify(login.json)}`);
const token = login.json?.data?.token;
const tenantId = login.json?.data?.user?.tenantId;
if (!token || !tenantId) fail("login sem token/tenantId");
console.log("   tenantId:", tenantId);

console.log("3) Billing status (antes)…");
const before = await api("/api/billing/status", { token });
if (before.status !== 200) fail(`status before ${before.status}`);
console.log("   status:", before.json?.data?.subscriptionStatus || before.json?.data?.subscription_status || before.json?.data);

console.log("4) POST checkout-session (Starter)…");
const checkout = await api("/api/billing/checkout-session", {
  method: "POST",
  token,
  body: { lid: "starter" },
});
if (checkout.status !== 200) {
  fail(`checkout ${checkout.status}: ${JSON.stringify(checkout.json)}`);
}
const sessionId = checkout.json?.data?.sessionId;
const checkoutUrl = checkout.json?.data?.url;
if (!sessionId || !checkoutUrl) fail("checkout sem sessionId/url");
console.log("   sessionId:", sessionId);
console.log("   url host:", new URL(checkoutUrl).host);

console.log("5) Stripe: PM de teste + subscription (modo test)…");
const session = await stripe.checkout.sessions.retrieve(sessionId);
const customerId =
  typeof session.customer === "string" ? session.customer : session.customer?.id;
if (!customerId) fail("checkout session sem customer");

const pm = await stripe.paymentMethods.create({
  type: "card",
  card: { token: "tok_visa" },
});
await stripe.paymentMethods.attach(pm.id, { customer: customerId });
await stripe.customers.update(customerId, {
  invoice_settings: { default_payment_method: pm.id },
});

const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceStarter }],
  default_payment_method: pm.id,
  metadata: {
    tenantId: String(tenantId),
    plan: "starter",
    lid: "starter",
    probe: stamp,
  },
});
console.log("   subscription:", subscription.id, "status:", subscription.status);

console.log("6) Webhook customer.subscription.updated…");
const wh1 = await postSignedWebhook(
  "customer.subscription.updated",
  subscription,
);
console.log("   HTTP", wh1.status, wh1.json);

console.log("7) Billing status (depois)…");
const after = await api("/api/billing/status", { token });
if (after.status !== 200) fail(`status after ${after.status}`);
const data = after.json?.data || {};
const subStatus = data.subscriptionStatus || data.subscription_status;
const plan = data.plan;
console.log("   plan:", plan, "subscriptionStatus:", subStatus);
console.log(
  "   stripeSubscriptionId:",
  data.stripeSubscriptionId || data.stripe_subscription_id || "(campo público pode omitir)",
);
if (!["active", "trialing"].includes(String(subStatus))) {
  fail(`assinatura não ativada (status=${subStatus})`);
}
if (plan && plan !== "starter") fail(`plan inesperado: ${plan}`);

console.log("8) Replay do mesmo subscription (idempotência)…");
const wh2 = await postSignedWebhook(
  "customer.subscription.updated",
  subscription,
);
console.log("   HTTP", wh2.status, wh2.json);
const after2 = await api("/api/billing/status", { token });
const subStatus2 =
  after2.json?.data?.subscriptionStatus ||
  after2.json?.data?.subscription_status;
if (subStatus2 !== subStatus) {
  fail(`replay alterou status ${subStatus} → ${subStatus2}`);
}
console.log("   status estável após replay:", subStatus2);

console.log("9) Cleanup: cancelar subscription Stripe test…");
const canceled = await stripe.subscriptions.cancel(subscription.id);
console.log("   canceled:", canceled.id, canceled.status);
const wh3 = await postSignedWebhook("customer.subscription.deleted", canceled);
console.log("   delete webhook HTTP", wh3.status);

console.log("\nPASS: checkout-session + webhook test + replay OK");
console.log("Throwaway email (pode ignorar):", email);
