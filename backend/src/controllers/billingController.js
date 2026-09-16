import { z } from "zod";
import { BillingService } from "../services/BillingService.js";
import { catchAsync } from "../utils/catchAsync.js";
import { requireTenantId } from "../utils/tenant.js";
import { PLANS } from "../utils/tenantFeatures.js";

const lidField = z.string().trim().min(1).max(64).optional();

const checkoutSchema = z
  .object({
    lid: lidField,
    plan: z.string().trim().min(1).max(64).optional(),
  })
  .refine((body) => Boolean(body.lid || body.plan), {
    message: "Informe o LID do plano para iniciar o checkout.",
  });

const adminPatchSchema = z.object({
  billingExempt: z.boolean().optional(),
  plan: z
    .enum([PLANS.starter, PLANS.ops, PLANS.fiscal, PLANS.complete])
    .nullable()
    .optional(),
  slug: z.string().min(2).max(64).optional(),
});

export const billingController = {
  listPublicPlans: catchAsync(async (req, res) => {
    const data = BillingService.getPublicCatalog();
    res.json({ success: true, data });
  }),

  getPublicPlan: catchAsync(async (req, res) => {
    const data = BillingService.getPublicPlanByLid(req.params.lid);
    res.json({ success: true, data });
  }),

  status: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const status = await BillingService.getStatus(tenantId);
    res.json({ success: true, data: status });
  }),

  checkout: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const { lid, plan } = checkoutSchema.parse(req.body);
    const result = await BillingService.createCheckoutSession({
      tenantId,
      lid,
      plan,
      email: req.context?.user?.email,
    });
    res.json({ success: true, data: result });
  }),

  portal: catchAsync(async (req, res) => {
    const tenantId = requireTenantId(req);
    const result = await BillingService.createPortalSession(tenantId);
    res.json({ success: true, data: result });
  }),

  webhook: catchAsync(async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: "Assinatura Stripe ausente",
      });
    }
    const result = await BillingService.handleWebhook(
      req.body,
      String(signature),
    );
    res.json(result);
  }),

  adminPatchTenant: catchAsync(async (req, res) => {
    const parsed = adminPatchSchema.parse(req.body);
    const idParam = req.params.id;
    const tenantId =
      idParam && idParam !== "by-slug" ? Number(idParam) : undefined;

    const data = await BillingService.adminUpdateTenantBilling({
      tenantId: Number.isInteger(tenantId) ? tenantId : undefined,
      slug: parsed.slug,
      billingExempt: parsed.billingExempt,
      plan: parsed.plan,
    });

    res.json({ success: true, data });
  }),
};
