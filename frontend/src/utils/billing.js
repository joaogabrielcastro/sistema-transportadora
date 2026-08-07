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

export const PLAN_CARDS = [
  {
    id: "starter",
    name: "Starter",
    description:
      "Ideal para organizar a frota do dia a dia: veículos, pneus, manutenção e visão de custos.",
    highlights: [
      "Cadastro de frota e composição",
      "Gastos e checklist de manutenção",
      "Controle de pneus e documentos",
      "Relatórios de custo por km",
    ],
  },
  {
    id: "ops",
    name: "Ops",
    description:
      "Para quem opera coleta e logística: emita e envie ordens em PDF por e-mail sem sair do sistema.",
    highlights: [
      "Tudo do Starter incluso",
      "Ordens de coleta personalizáveis",
      "PDF pronto para envio",
      "Histórico e reenvio por e-mail",
    ],
    popular: true,
  },
  {
    id: "fiscal",
    name: "Fiscal",
    description:
      "Para quem precisa ligar notas e estoque à operação: importe NF-e e baixe produtos por veículo.",
    highlights: [
      "Tudo do Starter incluso",
      "Importação de XML da NF-e",
      "Estoque atualizado automaticamente",
      "Baixa de produtos por caminhão",
    ],
  },
  {
    id: "complete",
    name: "Completo",
    description:
      "Pacote sob medida para a sua empresa: operações de coleta e módulo fiscal juntos, no mesmo ambiente.",
    highlights: [
      "Ordens de coleta + NF-e/estoque",
      "Frota, pneus e manutenção",
      "Relatórios e documentos",
      "Módulos ajustáveis ao seu fluxo",
    ],
  },
];
