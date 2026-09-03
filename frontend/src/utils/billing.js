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
    name: "Starter",
    tagline: "Organize a frota",
    description:
      "Veículos, pneus, manutenção, gastos e relatórios — o essencial para sair da planilha.",
    priceMonthlyBrl: 199,
    highlights: [
      "Até 15 veículos e 3 usuários",
      "Cadastro de frota e composição",
      "Gastos, checklist e manutenção",
      "Controle de pneus e documentos",
      "Relatórios de custo por km",
      "Motoristas e alertas",
    ],
    trialEligible: true,
  },
  {
    id: "fiscal",
    name: "Fiscal",
    tagline: "NF-e e estoque",
    description:
      "Tudo do Starter + importação de NF-e, estoque de peças e baixa por caminhão.",
    priceMonthlyBrl: 499,
    highlights: [
      "Até 40 veículos e 8 usuários",
      "Tudo do Starter",
      "Importação de XML da NF-e",
      "Cadastro manual de notas",
      "Estoque ligado à frota",
    ],
    popular: true,
  },
  {
    id: "complete",
    name: "Completo",
    tagline: "Operação full",
    description:
      "Pacote premium: frota + NF-e/estoque e tudo que o ATrack oferece para novos clientes.",
    priceMonthlyBrl: 699,
    highlights: [
      "Até 100 veículos e 20 usuários",
      "Tudo do Starter e do Fiscal",
      "NF-e, estoque e frota integrados",
      "Relatórios e documentos",
      "Melhor opção para operação madura",
    ],
    bestValue: true,
  },
];

/** Mescla catálogo local com payload da API (se existir). */
export function resolvePlanCards(apiPlans) {
  if (Array.isArray(apiPlans) && apiPlans.length) {
    return apiPlans.map((p) => ({
      ...p,
      priceLabel:
        p.priceLabel ?? formatPlanPrice(p.priceMonthlyBrl ?? 0),
    }));
  }
  return PLAN_CARDS.map((p) => ({
    ...p,
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
  starter: { maxVehicles: 15, maxUsers: 3 },
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
