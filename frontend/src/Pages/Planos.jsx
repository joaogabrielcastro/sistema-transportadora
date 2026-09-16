import React, { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Button } from "../components/ui";
import PlanComparison from "../components/PlanComparison.jsx";
import SiteLayout from "../components/site/SiteLayout.jsx";
import PlanCardGrid from "../components/site/PlanCardGrid.jsx";
import Seo from "../components/Seo.jsx";
import { PRODUCT_NAME, PUBLIC_REGISTER_ENABLED } from "../brand.js";
import {
  BILLING_TRIAL_DAYS,
  resolvePlanCards,
} from "../utils/billing.js";
import {
  PLAN_UNAVAILABLE_MESSAGE,
  planCtaHref,
  persistSelectedLid,
  registerHref,
  resolveSelectedLid,
} from "../utils/planLid.js";
import { trackFunnel } from "../utils/funnel.js";
import { usePublicPlansQuery } from "../hooks/queries/usePublicPlansQuery.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function Planos() {
  const { lid: pathLid } = useParams();
  const { isAuthenticated } = useAuth();
  const { data, isError } = usePublicPlansQuery();
  const trialDays = data?.trialDays || BILLING_TRIAL_DAYS;
  const plans = resolvePlanCards(data?.plans);
  const selected = resolveSelectedLid({ pathLid });
  const signupHref = PUBLIC_REGISTER_ENABLED ? registerHref("starter") : "/login";

  useEffect(() => {
    trackFunnel("view_plans", {
      lid: selected.invalid ? null : selected.lid || pathLid || null,
    });
  }, [pathLid, selected.invalid, selected.lid]);

  const highlighted = selected.lid
    ? plans.find((p) => (p.lid || p.id) === selected.lid)
    : null;

  return (
    <SiteLayout signupHref={signupHref}>
      <Seo
        title={`Planos ${PRODUCT_NAME}`}
        description={`Starter, Fiscal e Completo. Escolha o plano da sua transportadora e comece o cadastro com o identificador correto da oferta.`}
        path={pathLid ? `/planos/${pathLid}` : "/planos"}
      />

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
          Contratação
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Escolha o plano da sua operação
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-text-secondary sm:text-base">
          Preços e tetos vêm do catálogo oficial. Starter organiza a frota.
          Fiscal e Completo sobem capacidade e abrem NF-e, estoque e emissão
          de CT-e / MDF-e / CIOT. O identificador do plano (LID) segue para o
          cadastro e o checkout.
        </p>

        {selected.invalid ? (
          <Alert type="warning" className="mt-6" title="Plano indisponível">
            {PLAN_UNAVAILABLE_MESSAGE}
          </Alert>
        ) : null}

        {isError ? (
          <Alert type="info" className="mt-6">
            Não foi possível atualizar o catálogo agora. Os valores abaixo são
            a referência comercial do produto.
          </Alert>
        ) : null}

        {highlighted ? (
          <p className="mt-6 text-sm text-text-secondary">
            Plano selecionado: <strong>{highlighted.name}</strong> (LID{" "}
            <code className="rounded bg-background px-1.5 py-0.5 text-xs">
              {highlighted.lid}
            </code>
            ).
          </p>
        ) : null}

        <div className="mt-8">
          <PlanCardGrid
            plans={plans}
            isAuthenticated={isAuthenticated}
            registerEnabled={PUBLIC_REGISTER_ENABLED}
            trialDays={trialDays}
            ctaEvent="cta_plan_click"
          />
        </div>

        <div className="mt-12">
          <PlanComparison />
        </div>

        {highlighted ? (
          <div className="mt-10 rounded-2xl border border-border bg-white p-6 text-center shadow-card">
            <p className="text-sm text-text-secondary">
              Continuar com {highlighted.name}
            </p>
            <div className="mt-4">
              <Link
                to={planCtaHref({
                  lid: highlighted.lid,
                  isAuthenticated,
                  registerEnabled: PUBLIC_REGISTER_ENABLED,
                })}
                onClick={() => {
                  persistSelectedLid(highlighted.lid);
                  trackFunnel("cta_plan_click", {
                    lid: highlighted.lid,
                    location: "planos_highlight",
                  });
                }}
              >
                <Button variant="secondary" size="lg">
                  Começar agora
                </Button>
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </SiteLayout>
  );
}
