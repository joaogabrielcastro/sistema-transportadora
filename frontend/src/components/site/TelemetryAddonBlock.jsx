import React from "react";
import PropTypes from "prop-types";
import SalesContactButton from "./SalesContactButton.jsx";
import {
  SALES_CONTACT_ENABLED,
  TELEMETRY_ADDON,
} from "../../commercial.js";
import { formatPlanPrice } from "../../utils/billing.js";

const HIGHLIGHTS = [
  "Mapa em tempo real, histórico de rotas e velocidade",
  "Dispositivos (ex.: Teltonika), geocercas e alertas",
  `Âncora comercial: a partir de ${formatPlanPrice(TELEMETRY_ADDON.fromPerVehicleBrl)} por veículo/mês`,
  "Contrata junto a qualquer plano Starter, Fiscal ou Completo",
];

/**
 * Bloco comercial do módulo Telemetria (add-on, fora dos LIDs públicos).
 */
export default function TelemetryAddonBlock({ className = "" }) {
  return (
    <section
      className={`rounded-2xl border border-secondary/25 bg-gradient-to-br from-slate-50 via-white to-cyan-50/40 p-6 sm:p-8 ${className}`}
      aria-labelledby="telemetry-addon-title"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary">
            Módulo adicional
          </p>
          <h2
            id="telemetry-addon-title"
            className="mt-2 text-2xl font-bold tracking-tight text-primary-dark"
          >
            Telemetria e rastreamento
          </h2>
          <p className="mt-3 text-sm leading-6 text-text-secondary sm:text-base">
            Não entra nos planos Starter, Fiscal ou Completo. É um add-on da
            assinatura: você escolhe o plano de gestão da frota e, quando
            precisar, libera o monitoramento em tempo real.
          </p>
          <ul className="mt-5 space-y-2.5 text-sm text-text-secondary">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex gap-2">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-[10px] font-bold text-secondary"
                  aria-hidden
                >
                  ✓
                </span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {TELEMETRY_ADDON.tiers.map((tier) => (
              <article
                key={tier.id}
                className="rounded-xl border border-border bg-white p-4 shadow-card"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  {tier.name}
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-primary">
                  {formatPlanPrice(tier.priceMonthlyBrl)}
                  <span className="ml-1 text-sm font-medium text-text-light">
                    /mês
                  </span>
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  Até {tier.seatLimit} dispositivos · {tier.tagline}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="shrink-0 rounded-xl border border-border bg-white p-5 shadow-card lg:w-64">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-light">
            Como contratar
          </p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Mensalidade do software conforme a faixa. Chip, instalação do
            rastreador e homologação ficam fora — sob orçamento.
          </p>
          <p className="mt-3 text-sm font-medium text-text-primary">
            A partir de{" "}
            {formatPlanPrice(TELEMETRY_ADDON.fromPerVehicleBrl)}
            /veículo
          </p>
          {SALES_CONTACT_ENABLED ? (
            <div className="mt-4">
              <SalesContactButton
                location="telemetry_addon"
                variant="secondary"
                className="w-full"
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

TelemetryAddonBlock.propTypes = {
  className: PropTypes.string,
};
