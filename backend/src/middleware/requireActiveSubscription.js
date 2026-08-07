import prisma from "../lib/prisma.js";
import { requireTenantId } from "../utils/tenant.js";
import { hasActiveSubscriptionAccess } from "../utils/tenantFeatures.js";

/**
 * Bloqueia rotas de negócio se o tenant precisa de assinatura e não tem acesso.
 */
export const requireActiveSubscription = async (req, res, next) => {
  try {
    const tenantId = requireTenantId(req);
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        billing_exempt: true,
        subscription_status: true,
        trial_ends_at: true,
      },
    });

    if (!tenant) {
      return res.status(401).json({
        success: false,
        error: "Tenant não identificado",
      });
    }

    if (!hasActiveSubscriptionAccess(tenant)) {
      return res.status(402).json({
        success: false,
        error: "Assinatura necessária para continuar usando o sistema",
        code: "SUBSCRIPTION_REQUIRED",
      });
    }

    return next();
  } catch (err) {
    return next(err);
  }
};
