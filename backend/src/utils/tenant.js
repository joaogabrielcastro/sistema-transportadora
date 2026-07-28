import prisma from "../lib/prisma.js";

export const DEFAULT_TENANT_SLUG = "abbroto";

/**
 * Garante o tenant seed `abbroto` e retorna seu id.
 */
export async function ensureSeedTenant() {
  const existing = await prisma.tenants.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
  });
  if (existing) return existing;

  return prisma.tenants.create({
    data: {
      nome: "ABroto",
      slug: DEFAULT_TENANT_SLUG,
      ativo: true,
    },
  });
}

/**
 * Resolve tenantId padrão para AUTH_ENABLED=false / API token.
 * Prefer DEFAULT_TENANT_ID env; senão seed abbroto.
 */
export async function resolveDefaultTenantId() {
  const fromEnv = Number(process.env.DEFAULT_TENANT_ID);
  if (Number.isInteger(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }

  const tenant = await ensureSeedTenant();
  return tenant.id;
}

/**
 * Extrai tenantId numérico do request context ou lança erro HTTP-friendly.
 */
export function requireTenantId(req) {
  const raw = req?.context?.user?.tenantId;
  const tenantId = Number(raw);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    const err = new Error("Tenant não identificado");
    err.statusCode = 401;
    throw err;
  }
  return tenantId;
}
