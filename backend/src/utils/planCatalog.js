import {
  PLANS,
  PLAN_FEATURES,
  PUBLIC_BILLING_PLANS,
} from "./tenantFeatures.js";
import { PLAN_QUOTAS } from "./planQuotas.js";

/**
 * Catálogo comercial dos planos (preços de referência em BRL/mês).
 * Ordem de coleta não é vendida — exclusiva do tenant ABroto.
 */
export const PLAN_CATALOG = Object.freeze([
  {
    id: PLANS.starter,
    name: "Starter",
    tagline: "Organize a frota",
    description:
      "Veículos, pneus, manutenção, gastos e custo/km — o essencial para sair da planilha e operar no pátio.",
    priceMonthlyBrl: 199,
    highlights: [
      "Até 15 veículos e 3 usuários",
      "Frota com composição cavalo + carreta",
      "Pneus com posição, estoque e km rodado",
      "Gastos, checklist e manutenção",
      "Documentos, motoristas e alertas",
      "Relatórios de custo por km",
    ],
    modules: [],
    trialEligible: true,
  },
  {
    id: PLANS.fiscal,
    name: "Fiscal",
    tagline: "NF-e de compra e estoque",
    description:
      "Tudo do Starter + importação de NF-e de compra, estoque de peças e baixa por caminhão na manutenção.",
    priceMonthlyBrl: 499,
    highlights: [
      "Até 40 veículos e 8 usuários",
      "Tudo do Starter",
      "Importação de XML da NF-e",
      "Cadastro manual de notas",
      "Estoque de peças ligado à frota",
      "Baixa de peças na manutenção",
    ],
    modules: ["notas_estoque"],
    popular: true,
  },
  {
    id: PLANS.complete,
    name: "Completo",
    tagline: "Frota + fiscal de transporte",
    description:
      "Pacote premium: frota, NF-e/estoque e emissão de CT-e/MDF-e — o ATrack completo para operação madura.",
    priceMonthlyBrl: 699,
    highlights: [
      "Até 100 veículos e 20 usuários",
      "Tudo do Starter e do Fiscal",
      "Emissão de CT-e e MDF-e",
      "NF-e, estoque e frota integrados",
      "Maior capacidade e suporte prioritário",
    ],
    modules: ["notas_estoque", "transporte_fiscal"],
    bestValue: true,
  },
]);

/** @param {string} planId */
export function getPlanCatalogEntry(planId) {
  return PLAN_CATALOG.find((p) => p.id === planId) ?? null;
}

/** Payload para API / billing status (somente planos públicos). */
export function buildPlansPublic({ priceConfiguredFor }) {
  return PLAN_CATALOG.filter((plan) => PUBLIC_BILLING_PLANS.includes(plan.id)).map(
    (plan) => ({
      id: plan.id,
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
      priceConfigured: priceConfiguredFor(plan.id),
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
