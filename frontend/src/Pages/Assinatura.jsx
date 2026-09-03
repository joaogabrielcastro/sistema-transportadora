import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import PageLayout from "../components/layout/PageLayout.jsx";
import PlanComparison from "../components/PlanComparison.jsx";
import { Alert, Button, Card, PageHeader } from "../components/ui";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "../brand.js";
import {
  BILLING_TRIAL_DAYS,
  formatQuotaUsage,
  hasBillingAccess,
  planDisplayName,
  resolvePlanCards,
  trialDaysRemaining,
} from "../utils/billing.js";

function PlanBadge({ children, variant = "default" }) {
  const styles =
    variant === "popular"
      ? "bg-secondary/10 text-secondary"
      : variant === "current"
        ? "bg-success/10 text-success-dark"
        : variant === "value"
          ? "bg-primary/10 text-primary"
          : "bg-background text-text-secondary";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles}`}
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
  const showAsCurrent = isCurrent && (isActive || isTrialing);

  const accent =
    plan.popular
      ? "border-t-4 border-t-secondary"
      : plan.bestValue
        ? "border-t-4 border-t-primary"
        : "border-t-4 border-t-border";

  return (
    <Card
      className={`flex h-full min-w-0 flex-col shadow-card transition-shadow hover:shadow-soft ${accent}`}
    >
      <div className="flex h-full flex-col p-5 sm:p-6">
        <div className="mb-4 min-h-[7.5rem]">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-text-primary">{plan.name}</h3>
            {showAsCurrent && (
              <PlanBadge variant="current">Seu plano</PlanBadge>
            )}
            {plan.popular && !showAsCurrent && (
              <PlanBadge variant="popular">Popular</PlanBadge>
            )}
            {plan.bestValue && !plan.popular && (
              <PlanBadge variant="value">Completo</PlanBadge>
            )}
          </div>
          {plan.tagline && (
            <p className="text-[11px] font-semibold uppercase tracking-widest text-secondary">
              {plan.tagline}
            </p>
          )}
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight text-primary">
              {plan.priceLabel ||
                new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                }).format(plan.priceMonthlyBrl)}
            </span>
            <span className="text-sm text-text-light">/mês</span>
          </div>
          {plan.trialEligible && !isActive && (
            <p className="mt-1.5 text-xs font-medium text-success-dark">
              {BILLING_TRIAL_DAYS} dias grátis no cadastro
            </p>
          )}
        </div>

        <p className="mb-4 text-sm leading-relaxed text-text-secondary">
          {plan.description}
        </p>

        <ul className="mb-5 flex-1 space-y-2 text-sm text-text-primary">
          {plan.highlights.map((h) => (
            <li key={h} className="flex gap-2">
              <span
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-[10px] font-bold text-secondary"
                aria-hidden
              >
                ✓
              </span>
              <span className="leading-snug">{h}</span>
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

  const stripeMissingPrices = useMemo(() => {
    if (status?.stripeConfigured !== false) return false;
    return planCards.some((p) => p.priceConfigured === false);
  }, [status?.stripeConfigured, planCards]);

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
            <Link to="/empresa" className="underline font-medium">
              Dados da empresa
            </Link>
            {" · "}
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
  const quota = status?.quota || user?.quota;
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
      <div className="mx-auto w-full max-w-[72rem] space-y-8 pb-10">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
            {PRODUCT_NAME} · {PRODUCT_TAGLINE}
          </p>
          <PageHeader
            title="Escolha seu plano"
            subtitle="Três opções para sua transportadora — cobrança mensal por empresa, sem surpresas."
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
        </div>

        <div className="mx-auto max-w-3xl space-y-3">
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
              {days === 0 ? "último dia" : `${days} dia(s) restante(s)`}.
            </Alert>
          )}

          {quota && !quota.unlimited && (
            <Alert type="info">
              Uso do plano {planDisplayName(quota.plan || currentPlan)}:{" "}
              <strong>{formatQuotaUsage(quota.vehicles)}</strong> veículos e{" "}
              <strong>{formatQuotaUsage(quota.users)}</strong> usuários
              {quota.users?.pendingInvites > 0
                ? ` (inclui ${quota.users.pendingInvites} convite(s) pendente(s))`
                : ""}
              .
            </Alert>
          )}

          {isActive && currentPlan && (
            <Alert type="success">
              Plano ativo: <strong>{planDisplayName(currentPlan)}</strong>.
            </Alert>
          )}

          {status?.stripeConfigured === false && (
            <Alert type="warning">
              Pagamentos ainda não estão ativos neste ambiente. Os valores abaixo
              são referência até configurar o Stripe no servidor.
            </Alert>
          )}
        </div>

        {/* 3 colunas fixas — lado a lado no desktop */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5 lg:gap-6">
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

        <PlanComparison />

        {user?.role === "admin" && (
          <p className="text-center text-sm">
            <Link
              to="/empresa"
              className="font-medium text-secondary hover:text-secondary-dark"
            >
              Dados da empresa
            </Link>
          </p>
        )}

        {user?.role !== "admin" && (
          <p className="text-center text-sm text-text-secondary">
            Apenas administradores podem alterar o plano.
          </p>
        )}

        {accessOk && (
          <p className="text-center">
            <Link
              to="/"
              className="font-medium text-secondary hover:text-secondary-dark"
            >
              ← Voltar ao sistema
            </Link>
          </p>
        )}

        {user?.role === "admin" && stripeMissingPrices && (
          <p className="text-center text-xs text-text-light">
            Admin: configure STRIPE_PRICE_STARTER, STRIPE_PRICE_FISCAL e
            STRIPE_PRICE_COMPLETE no Coolify.
          </p>
        )}
      </div>
    </PageLayout>
  );
}
