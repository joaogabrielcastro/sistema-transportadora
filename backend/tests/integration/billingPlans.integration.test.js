import "../helpers/env/authEnabled.js";

import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../../src/app.js";
import { PUBLIC_BILLING_PLANS } from "../../src/utils/tenantFeatures.js";

test("GET /api/billing/plans é público e devolve LID de cada plano", async () => {
  const res = await request(app).get("/api/billing/plans");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const plans = res.body.data?.plans;
  assert.ok(Array.isArray(plans));
  assert.deepEqual(
    plans.map((p) => p.lid),
    [...PUBLIC_BILLING_PLANS],
  );
  for (const plan of plans) {
    assert.equal(plan.lid, plan.id);
    assert.equal(typeof plan.priceMonthlyBrl, "number");
    assert.ok(!("priceId" in plan));
  }
});

test("GET /api/billing/plans/:lid devolve o plano correto", async () => {
  const res = await request(app).get("/api/billing/plans/fiscal");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.plan.lid, "fiscal");
  assert.equal(res.body.data.plan.name, "Fiscal");
});

test("GET /api/billing/plans/:lid rejeita plano inexistente", async () => {
  const res = await request(app).get("/api/billing/plans/profissional");
  assert.equal(res.status, 404);
  assert.equal(res.body.code, "LID_INVALID");
});

test("GET /api/billing/plans/:lid rejeita plano legado desativado", async () => {
  const res = await request(app).get("/api/billing/plans/ops");
  assert.equal(res.status, 404);
});

test("POST /api/billing/checkout-session exige autenticação", async () => {
  const res = await request(app)
    .post("/api/billing/checkout-session")
    .send({ lid: "starter" });
  assert.equal(res.status, 401);
});
