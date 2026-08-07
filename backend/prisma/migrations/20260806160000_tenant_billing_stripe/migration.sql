-- Billing / Stripe fields on tenants
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billing_exempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "plan" VARCHAR(32);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subscription_status" VARCHAR(32);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ(6);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(255);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" VARCHAR(255);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripe_price_id" VARCHAR(255);

-- Existing tenants: grandfathered (no Stripe required)
UPDATE "tenants"
SET
  "billing_exempt" = true,
  "subscription_status" = COALESCE("subscription_status", 'active')
WHERE "billing_exempt" = false
  AND "stripe_customer_id" IS NULL
  AND "stripe_subscription_id" IS NULL
  AND ("trial_ends_at" IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_stripe_customer_id_key" ON "tenants"("stripe_customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_stripe_subscription_id_key" ON "tenants"("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "tenants_stripe_customer_id_idx" ON "tenants"("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "tenants_billing_exempt_idx" ON "tenants"("billing_exempt");
