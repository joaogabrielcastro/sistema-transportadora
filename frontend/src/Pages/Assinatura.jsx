import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import PageLayout from "../components/layout/PageLayout.jsx";
import PlanComparison from "../components/PlanComparison.jsx";
import { Alert, Button, Card, PageHeader } from "../components/ui";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import {
  hasBillingAccess,
  planDisplayName,
  resolvePlanCards,
  trialDaysRemaining,
} from "../utils/billing.js";

function PlanBadge({ children, variant = "default" }) {
  const styles =
    variant === "popular"
      ? "bg-secondary/15 text-secondary"
      : variant === "current"
        ? "bg-emerald-50 text-emerald-800"
        : variant === "value"
          ? "bg-amber-50 text-amber-900"
          : "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}
    >
      {children}
    </span>
  );
}

function PlanCard({
  plan,
  currentPlan,
  isTrialing,
  isActive,
  user,
  status,
  loadingPlan,
  onSubscribe,
}) {
  const isCurrent = currentPlan === plan.id;
  const onTrialThisPlan = isTrialing && isCurrent;
  const priceOk = plan.priceConfigured !== false;
  const showAsCurrent = isCurrent && (isActive || isTrialing);

  const ringClass = plan.popular
    ? "ring-2 ring-secondary shadow-lg shadow-secondary/10"
    : plan.bestValue
      ? "ring-2 ring-amber-400/90 shadow-lg shadow-amber-400/10"
      : "ring-1 ring-slate-200/80 shadow-sm";

  return (
    <Card
      className={`flex h-full w-full max-w-sm flex-col transition-transform hover:-translate-y-0.5 ${ringClass} ${
        plan.popular ? "md:scale-[1.02]" : ""
      }`}
    >
      <div className="flex h-full flex-col p-1">
        <div className="mb-4">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
            {showAsCurrent && (
              <PlanBadge variant="current">Seu plano</PlanBadge>
            )}
            {plan.popular && !showAsCurrent && (
              <PlanBadge variant="popular">Mais pedido</PlanBadge>
            )}
            {plan.bestValue && !plan.popular && (
              <PlanBadge variant="value">Melhor valor</PlanBadge>
            )}
          </div>
          {plan.tagline && (
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-secondary sm:text-left">
              {plan.tagline}
            </p>
          )}
          <div className="mt-4 flex items-baseline justify-center gap-1 sm:justify-start">
            <span className="text-4xl font-bold tracking-tight text-slate-900">
              {plan.priceLabel ||
                new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                }).format(plan.priceMonthlyBrl)}
            </span>
            <span className="text-sm text-slate-500">/mês</span>
          </div>
          {plan.trialEligible && !isActive && (
            <p className="mt-2 text-center text-xs font-medium text-emerald-700 sm:text-left">
              14 dias grátis no cadastro
            </p>
          )}
          <p className="mt-4 text-center text-sm leading-relaxed text-slate-600 sm:text-left">
            {plan.description}
          </p>
        </div>

        <ul className="mb-6 flex-1 space-y-2 text-sm text-slate-700">
          {plan.highlights.map((h) => (
            <li key={h} className="flex gap-2">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary"
                aria-hidden
              >
                ✓
              </span>
              <span>{h}</span>
            </li>
          ))}
        </ul>

        <Button
          className="w-full"
          variant={showAsCurrent && isActive ? "secondary" : "primary"}
          disabled={
            user?.role !== "admin" ||
            loadingPlan != null ||
            status?.stripeConfigured === false ||
            (isActive && isCurrent)
          }
          loading={loadingPlan === plan.id}
          onClick={() => onSubscribe(plan.id)}
        >
          {isActive && isCurrent
            ? "Plano atual"
            : onTrialThisPlan
              ? "Assinar este plano"
              : isCurrent && isTrialing
                ? "Continuar no trial"
                : "Assinar"}
        </Button>
        {!priceOk && (
          <p className="mt-2 text-center text-xs text-amber-700">
            Price ID deste plano não configurado no servidor.
          </p>
        )}
      </div>
    </Card>
  );
}

export default function Assinatura() {
  const { user, refreshProfile, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [status, setStatus] = useState(null);

  const checkoutFlag = searchParams.get("checkout");

  useEffect(() => {
    if (checkoutFlag === "success") {
      setInfo("Pagamento recebido. Atualizando sua assinatura…");
      refreshProfile?.().finally(() => {
        setInfo("Assinatura atualizada com sucesso.");
      });
    } else if (checkoutFlag === "cancel") {
      setInfo("Checkout cancelado. Você pode escolher um plano quando quiser.");
    }
  }, [checkoutFlag, refreshProfile]);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiFetch({ url: "/billing/status" });
      const data = res.data ?? res;
      setStatus(data);
    } catch {
      /* status opcional se Stripe off */
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadStatus();
  }, [isAuthenticated, loadStatus]);

  const planCards = useMemo(
    () => resolvePlanCards(status?.plans),
    [status?.plans],
  );

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.billingExempt) {
    return (
      <PageLayout>
        <div className="mx-auto max-w-2xl space-y-6">
          <PageHeader
            title="Assinatura"
            subtitle="Sua empresa está isenta de cobrança."
          />
          <Alert type="info">
            Clientes atuais não precisam assinar. Continue usando o sistema
            normalmente.{" "}
            <Link to="/" className="underline font-medium">
              Voltar ao início
            </Link>
          </Alert>
        </div>
      </PageLayout>
    );
  }

  const days = trialDaysRemaining(user);
  const accessOk = hasBillingAccess(user);
  const currentPlan = status?.plan || user?.plan;
  const isTrialing = user?.subscriptionStatus === "trialing";
  const isActive = user?.subscriptionStatus === "active";
  const canManage = isActive;

  const startCheckout = async (planId) => {
    setError("");
    setLoadingPlan(planId);
    try {
      const res = await apiFetch({
        method: "POST",
        url: "/billing/checkout-session",
        data: { plan: planId },
      });
      const url = res.data?.url;
      if (!url) throw new Error("URL de checkout não retornada");
      window.location.href = url;
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Falha ao iniciar checkout");
      setLoadingPlan(null);
    }
  };

  const openPortal = async () => {
    setError("");
    setPortalLoading(true);
    try {
      const res = await apiFetch({
        method: "POST",
        url: "/billing/portal-session",
      });
      const url = res.data?.url;
      if (!url) throw new Error("URL do portal não retornada");
      window.location.href = url;
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message || "Falha ao abrir portal");
      setPortalLoading(false);
    }
  };

  return (
    <PageLayout>
      <div className="mx-auto w-full max-w-6xl space-y-10 pb-8">
        <PageHeader
            title="Planos e assinatura"
            subtitle="Preços por empresa/mês. Escolha o módulo que combina com sua operação — você pode evoluir quando precisar."
            centered
            actions={
              canManage ? (
                <Button
                  variant="secondary"
                  onClick={openPortal}
                  loading={portalLoading}
                >
                  Gerenciar no Stripe
                </Button>
              ) : null
            }
          />

        <div className="mx-auto max-w-3xl space-y-4">
          {info && <Alert type="success">{info}</Alert>}
          {error && <Alert type="error">{error}</Alert>}

          {!accessOk && (
            <Alert type="warning">
              Seu período de teste expirou ou a assinatura está inativa. Escolha
              um plano para continuar.
            </Alert>
          )}

          {accessOk && isTrialing && days != null && (
            <Alert type="info">
              Trial no plano <strong>{planDisplayName(currentPlan)}</strong>:{" "}
              {days === 0 ? "último dia" : `${days} dia(s) restante(s)`}. Depois
              do trial, assine um plano abaixo para manter o acesso.
            </Alert>
          )}

          {isActive && currentPlan && (
            <Alert type="success">
              Plano ativo: <strong>{planDisplayName(currentPlan)}</strong>. Use
              &quot;Gerenciar no Stripe&quot; para trocar cartão ou cancelar.
            </Alert>
          )}

          {status && status.stripeConfigured === false && (
            <Alert type="warning">
              Stripe ainda não está configurado neste ambiente. Os preços abaixo
              são referência — configure STRIPE_SECRET_KEY e os Price IDs no
              backend.
            </Alert>
          )}
        </div>

        <div className="text-center">
          <p className="text-sm text-slate-600">
            Valores em reais (R$/mês) · cobrança recorrente via Stripe
          </p>
        </div>

        {/* Planos centralizados */}
        <div className="flex flex-wrap items-stretch justify-center gap-6 px-2">
          {planCards.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              currentPlan={currentPlan}
              isTrialing={isTrialing}
              isActive={isActive}
              user={user}
              status={status}
              loadingPlan={loadingPlan}
              onSubscribe={startCheckout}
            />
          ))}
        </div>

        {/* Comparação detalhada — estilo acordeão */}
        <PlanComparison />

        {user?.role !== "admin" && (
          <p className="text-center text-sm text-slate-600">
            Apenas administradores da empresa podem alterar o plano. Peça ao admin
            da conta.
          </p>
        )}

        {accessOk && (
          <p className="text-center">
            <Link
              to="/"
              className="font-medium text-secondary hover:underline"
            >
              ← Voltar ao sistema
            </Link>
          </p>
        )}

        {user?.role === "admin" && status?.stripeConfigured === false && (
          <details className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-800">
              Referência Stripe (admin)
            </summary>
            <ul className="mt-2 space-y-1">
              <li>
                <strong>Starter</strong> — R$ 199/mês · STRIPE_PRICE_STARTER
              </li>
              <li>
                <strong>Fiscal</strong> — R$ 499/mês · STRIPE_PRICE_FISCAL
              </li>
              <li>
                <strong>Completo</strong> — R$ 699/mês · STRIPE_PRICE_COMPLETE
              </li>
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Ordem de coleta não é vendida (exclusiva ABroto).
            </p>
          </details>
        )}
      </div>
    </PageLayout>
  );
}
