import prisma from "../lib/prisma.js";
import { requireTenantId } from "../utils/tenant.js";
import { resolveTenantFeatures } from "../utils/tenantFeatures.js";

/**
 * Bloqueia rota se o tenant não tiver a feature ligada.
 * @param {'ordem_coleta' | 'notas_estoque'} featureKey
 */
export const requireFeature = (featureKey) => async (req, res, next) => {
  try {
    const tenantId = requireTenantId(req);
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        slug: true,
        features: true,
        billing_exempt: true,
        plan: true,
      },
    });

    if (!tenant) {
      return res.status(401).json({
        success: false,
        error: "Tenant não identificado",
      });
    }

    const features = resolveTenantFeatures({
      raw: tenant.features,
      slug: tenant.slug,
      billingExempt: tenant.billing_exempt,
      plan: tenant.plan,
    });

    if (!features[featureKey]) {
      return res.status(403).json({
        success: false,
        error: "Módulo não disponível para esta empresa",
        feature: featureKey,
      });
    }

    req.tenantFeatures = features;
    req.tenantSlug = tenant.slug;
    return next();
  } catch (err) {
    return next(err);
  }
};
