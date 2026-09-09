import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Button } from "../ui";
import { BILLING_TRIAL_DAYS } from "../../utils/billing.js";
import { planCtaHref, persistSelectedLid } from "../../utils/planLid.js";
import { trackFunnel } from "../../utils/funnel.js";

function CheckItem({ children }) {
  return (
    <li className="flex gap-2">
      <span
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-[10px] font-bold text-secondary"
        aria-hidden
      >
        ✓
      </span>
      <span className="leading-snug">{children}</span>
    </li>
  );
}

CheckItem.propTypes = {
  children: PropTypes.node,
};

export default function PlanCardGrid({
  plans,
  isAuthenticated = false,
  registerEnabled = true,
  trialDays = BILLING_TRIAL_DAYS,
  ctaEvent = "cta_plan_click",
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {plans.map((plan) => {
        const lid = plan.lid || plan.id;
        const href = planCtaHref({
          lid,
          isAuthenticated,
          registerEnabled,
        });
        const accent = plan.popular
          ? "border-t-4 border-t-secondary ring-1 ring-secondary/20"
          : plan.bestValue
            ? "border-t-4 border-t-primary"
            : "border-t-4 border-t-border";

        return (
          <article
            key={lid}
            className={`flex h-full flex-col rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6 ${accent}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold">{plan.name}</h3>
              {plan.popular ? (
                <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-secondary">
                  Popular
                </span>
              ) : null}
              {plan.bestValue ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Completo
                </span>
              ) : null}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-secondary">
              {plan.tagline}
            </p>
            <p className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight text-primary">
                {plan.priceLabel}
              </span>
              <span className="text-sm text-text-light">/mês</span>
            </p>
            {plan.trialEligible ? (
              <p className="mt-1.5 text-xs font-medium text-success-dark">
                {trialDays} dias grátis no cadastro
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-text-secondary">
                Contratação após criar a conta
              </p>
            )}
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              {plan.description}
            </p>
            <ul className="mt-4 mb-5 flex-1 space-y-2 text-sm">
              {(plan.highlights || []).map((h) => (
                <CheckItem key={h}>{h}</CheckItem>
              ))}
            </ul>
            <Link
              to={href}
              className="mt-auto"
              onClick={() => {
                persistSelectedLid(lid);
                trackFunnel(ctaEvent, { lid, plan: plan.id, location: "plan_card" });
              }}
            >
              <Button
                className="w-full"
                variant={plan.popular ? "secondary" : "primary"}
              >
                Começar agora
              </Button>
            </Link>
          </article>
        );
      })}
    </div>
  );
}

PlanCardGrid.propTypes = {
  plans: PropTypes.arrayOf(PropTypes.object).isRequired,
  isAuthenticated: PropTypes.bool,
  registerEnabled: PropTypes.bool,
  trialDays: PropTypes.number,
  ctaEvent: PropTypes.string,
};
