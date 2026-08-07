import React, { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import PageLayout from "../components/layout/PageLayout.jsx";
import { Alert, Button, Card, PageHeader } from "../components/ui";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import {
  PLAN_CARDS,
  hasBillingAccess,
  trialDaysRemaining,
} from "../utils/billing.js";

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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.billingExempt) {
    return (
      <PageLayout>
        <div className="space-y-6">
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
  const canManage =
    status?.subscriptionStatus === "active" ||
    user?.subscriptionStatus === "active";

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
      <div className="space-y-6">
        <PageHeader
          title="Planos e assinatura"
          subtitle="Escolha o pacote que combina com o fluxo da sua transportadora. Cada plano libera módulos diferentes — você pode evoluir quando precisar."
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

        {info && <Alert type="success">{info}</Alert>}
        {error && <Alert type="error">{error}</Alert>}

        {!accessOk && (
          <Alert type="warning">
            Seu período de teste expirou ou a assinatura está inativa. Escolha um
            plano para continuar.
          </Alert>
        )}

        {accessOk && user?.subscriptionStatus === "trialing" && days != null && (
          <Alert type="info">
            Trial ativo{currentPlan ? ` (plano ${currentPlan})` : ""}:{" "}
            <strong>
              {days === 0 ? "último dia" : `${days} dia(s) restante(s)`}
            </strong>
            . Assine antes do fim para não perder o acesso.
          </Alert>
        )}

        {status && status.stripeConfigured === false && (
          <Alert type="warning">
            Stripe ainda não está configurado neste ambiente. Defina
            STRIPE_SECRET_KEY e os Price IDs no backend.
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_CARDS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const priceOk =
              !status?.plans ||
              status.plans.find((p) => p.id === plan.id)?.priceConfigured !==
                false;

            return (
              <Card
                key={plan.id}
                className={plan.popular ? "ring-2 ring-secondary" : ""}
              >
                <div className="flex flex-col h-full">
                  <div className="mb-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {plan.name}
                      </h3>
                      {plan.popular && (
                        <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed min-h-[4.5rem]">
                      {plan.description}
                    </p>
                  </div>
                  <ul className="mb-6 space-y-1.5 text-sm text-slate-700 flex-1">
                    {plan.highlights.map((h) => (
                      <li key={h} className="flex gap-2">
                        <span className="text-secondary" aria-hidden>
                          ✓
                        </span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrent && canManage ? "secondary" : "primary"}
                    disabled={
                      user?.role !== "admin" ||
                      loadingPlan != null ||
                      status?.stripeConfigured === false
                    }
                    loading={loadingPlan === plan.id}
                    onClick={() => startCheckout(plan.id)}
                  >
                    {isCurrent && canManage
                      ? "Plano atual — trocar"
                      : "Assinar"}
                  </Button>
                  {!priceOk && (
                    <p className="mt-2 text-xs text-amber-700">
                      Price ID deste plano não configurado no servidor.
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {user?.role !== "admin" && (
          <p className="text-sm text-slate-600">
            Apenas administradores da empresa podem alterar o plano. Peça ao
            admin da conta.
          </p>
        )}

        {accessOk && (
          <p>
            <Link
              to="/"
              className="text-secondary font-medium hover:underline"
            >
              ← Voltar ao sistema
            </Link>
          </p>
        )}
      </div>
    </PageLayout>
  );
}
