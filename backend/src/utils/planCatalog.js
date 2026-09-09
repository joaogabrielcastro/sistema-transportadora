import {
  PLANS,
  PLAN_FEATURES,
  PUBLIC_BILLING_PLANS,
  isPublicBillingPlan,
} from "./tenantFeatures.js";
import { PLAN_QUOTAS } from "./planQuotas.js";

export const PLAN_UNAVAILABLE_MESSAGE =
  "Este plano não está disponível para contratação. Escolha um plano válido na página de planos.";

export const LID_MISSING_MESSAGE =
  "Selecione um plano para continuar a contratação.";

/**
 * Catálogo comercial dos planos (preços de referência em BRL/mês).
 * Ordem de coleta não é vendida — exclusiva do tenant ABroto.
 */
export const PLAN_CATALOG = Object.freeze([
  {
    id: PLANS.starter,
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
    modules: [],
    trialEligible: true,
  },
  {
    id: PLANS.fiscal,
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
    modules: ["notas_estoque", "transporte_fiscal"],
    popular: true,
  },
  {
    id: PLANS.complete,
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
    modules: ["notas_estoque", "transporte_fiscal"],
    bestValue: true,
  },
]);

/**
 * LID público da oferta = id do catálogo (starter | fiscal | complete).
 * Não usar o nome comercial nem o Price ID do Stripe no frontend.
 * @param {string | null | undefined} planId
 */
export function lidForPlan(planId) {
  return isPublicBillingPlan(planId) ? planId : null;
}

/**
 * Normaliza o identificador recebido do frontend (query, body ou slug).
 * @param {unknown} value
 */
export function normalizeLid(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

/**
 * Resolve um LID público para o plano do catálogo.
 * O Stripe Price ID nunca é o LID — o backend mapeia lid → plan → preço.
 *
 * @param {unknown} lid
 * @returns {{ ok: true, plan: (typeof PLAN_CATALOG)[number], lid: string } | { ok: false, code: string, message: string }}
 */
export function resolvePublicPlanByLid(lid) {
  const normalized = normalizeLid(lid);
  if (!normalized) {
    return {
      ok: false,
      code: "LID_MISSING",
      message: LID_MISSING_MESSAGE,
    };
  }

  const plan = PLAN_CATALOG.find((item) => item.id === normalized);
  if (!plan || !PUBLIC_BILLING_PLANS.includes(plan.id)) {
    return {
      ok: false,
      code: "LID_INVALID",
      message: PLAN_UNAVAILABLE_MESSAGE,
    };
  }

  return { ok: true, plan, lid: plan.id };
}

/**
 * Erro HTTP amigável para LID inválido / plano indisponível.
 * @param {{ code?: string, message?: string, statusCode?: number }} [opts]
 */
export function planUnavailableError(opts = {}) {
  const err = new Error(opts.message || PLAN_UNAVAILABLE_MESSAGE);
  err.statusCode = opts.statusCode ?? 400;
  err.code = opts.code || "LID_INVALID";
  return err;
}

/** Payload para API / billing status e catálogo público. */
export function buildPlansPublic({ priceConfiguredFor } = {}) {
  const configured =
    typeof priceConfiguredFor === "function"
      ? priceConfiguredFor
      : () => false;

  return PLAN_CATALOG.filter((plan) => PUBLIC_BILLING_PLANS.includes(plan.id)).map(
    (plan) => ({
      id: plan.id,
      lid: lidForPlan(plan.id),
      name: plan.name,
      tagline: plan.tagline,
      description: plan.description,
      priceMonthlyBrl: plan.priceMonthlyBrl,
      priceLabel: formatPlanPrice(plan.priceMonthlyBrl),
      highlights: plan.highlights,
      quotas: PLAN_QUOTAS[plan.id] ?? null,
      modules: plan.modules,
      features: PLAN_FEATURES[plan.id],
      popular: Boolean(plan.popular),
      bestValue: Boolean(plan.bestValue),
      trialEligible: Boolean(plan.trialEligible),
      available: true,
      priceConfigured: configured(plan.id),
    }),
  );
}

/** @param {number} value */
export function formatPlanPrice(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
