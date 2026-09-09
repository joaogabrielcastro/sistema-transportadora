/**
 * Helpers de billing no frontend (espelham a lógica do backend).
 */

export function hasBillingAccess(user, now = new Date()) {
  if (!user) return true;
  if (user.billingExempt === true) return true;
  if (user.hasBillingAccess === true) return true;
  if (user.hasBillingAccess === false) return false;

  const status = user.subscriptionStatus ?? "none";
  if (status === "active" || status === "past_due") return true;
  if (status === "trialing") {
    if (!user.trialEndsAt) return true;
    return new Date(user.trialEndsAt).getTime() > now.getTime();
  }
  return false;
}

export function trialDaysRemaining(user, now = new Date()) {
  if (!user?.trialEndsAt || user.billingExempt) return null;
  if (user.subscriptionStatus !== "trialing") return null;
  const ms = new Date(user.trialEndsAt).getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function featureEnabled(user, featureKey) {
  const features = user?.features || {};
  return features[featureKey] === true;
}

/** Alinhar com BILLING_TRIAL_DAYS no backend (padrão 14). */
export const BILLING_TRIAL_DAYS = 14;

export function formatPlanPrice(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Planos vendáveis — ordem de coleta não entra (exclusiva ABroto). */
export const PLAN_CARDS = [
  {
    id: "starter",
    lid: "starter",
    name: "Starter",
    tagline: "Frota pequena",
    description:
      "Cadastre veículos, lance gastos e manutenção. Para quem está saindo da planilha — não para operação de porte médio.",
    priceMonthlyBrl: 199,
    highlights: [
      "Até 8 veículos e 2 usuários",
      "Dashboard, frota, motoristas e documentos",
      "Pneus, gastos, manutenção e alertas",
      "Relatórios de custo por km",
      "Sem NF-e, estoque e emissão de CT-e / MDF-e",
    ],
    trialEligible: true,
  },
  {
    id: "fiscal",
    lid: "fiscal",
    name: "Fiscal",
    tagline: "NF-e, estoque e emissão fiscal",
    description:
      "Tudo do Starter, com teto maior, NF-e ligada à frota e emissão de CT-e, MDF-e e contrato de frete.",
    priceMonthlyBrl: 499,
    highlights: [
      "Até 40 veículos e 8 usuários",
      "Tudo do Starter",
      "Importação de XML da NF-e e estoque de peças",
      "Baixa de peças na manutenção",
      "CT-e, MDF-e, averbação e contrato de frete (CIOT)",
    ],
    popular: true,
  },
  {
    id: "complete",
    lid: "complete",
    name: "Completo",
    tagline: "Operação maior",
    description:
      "Mesmos módulos do Fiscal, com mais veículos e usuários para operação que já cresceu.",
    priceMonthlyBrl: 699,
    highlights: [
      "Até 100 veículos e 20 usuários",
      "Tudo do Starter e do Fiscal",
      "NF-e, estoque, CT-e, MDF-e e CIOT",
      "Para frota e equipe que já passaram do porte médio",
    ],
    bestValue: true,
  },
];

/** Mescla catálogo local com payload da API (fonte oficial quando disponível). */
export function resolvePlanCards(apiPlans) {
  if (Array.isArray(apiPlans) && apiPlans.length) {
    return apiPlans.map((p) => {
      const lid = p.lid || p.id;
      return {
        ...p,
        id: p.id || lid,
        lid,
        priceLabel: p.priceLabel ?? formatPlanPrice(p.priceMonthlyBrl ?? 0),
      };
    });
  }
  return PLAN_CARDS.map((p) => ({
    ...p,
    lid: p.lid || p.id,
    priceLabel: formatPlanPrice(p.priceMonthlyBrl),
  }));
}

export const PLAN_LABELS = {
  starter: "Starter",
  ops: "Ops",
  fiscal: "Fiscal",
  complete: "Completo",
};

export function planDisplayName(planId) {
  return PLAN_LABELS[planId] || planId || "—";
}

/** Espelha backend/src/utils/planQuotas.js */
export const PLAN_QUOTAS = {
  starter: { maxVehicles: 8, maxUsers: 2 },
  ops: { maxVehicles: 40, maxUsers: 8 },
  fiscal: { maxVehicles: 40, maxUsers: 8 },
  complete: { maxVehicles: 100, maxUsers: 20 },
};

export function isQuotaReached(used, limit) {
  if (limit == null) return false;
  return Number(used) >= Number(limit);
}

export function isVehicleQuotaReached(user) {
  const quota = user?.quota;
  if (!quota || quota.unlimited) return false;
  return isQuotaReached(quota.vehicles?.used, quota.vehicles?.limit);
}

export function isUserQuotaReached(user) {
  const quota = user?.quota;
  if (!quota || quota.unlimited) return false;
  return isQuotaReached(quota.users?.used, quota.users?.limit);
}

export function formatQuotaUsage(part) {
  if (!part || part.limit == null) return "Ilimitado";
  return `${part.used}/${part.limit}`;
}
