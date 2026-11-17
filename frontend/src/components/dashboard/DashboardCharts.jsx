import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Card } from "../ui";
import CostPerKmTrendChart from "../relatorios/CostPerKmTrendChart.jsx";
import { formatCurrency } from "../../utils/formatters.js";

const linkClass =
  "rounded text-[13px] font-semibold text-secondary-dark hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary";

/**
 * Bloco analítico do painel: evolução mensal do custo e ranking dos veículos
 * que mais custam (com custo por km). Composição da frota e divisão
 * gastos × manutenção saíram do painel — mudam pouco e não pedem ação diária.
 */
export default function DashboardCharts({
  trendMonths = [],
  trendLoading = false,
  truckCosts = [],
  truckCostsLoading = false,
}) {
  const topTrucks = useMemo(
    () =>
      (Array.isArray(truckCosts) ? truckCosts : [])
        .filter((item) => Number(item.totalCost) > 0)
        .sort((a, b) => Number(b.totalCost) - Number(a.totalCost))
        .slice(0, 6),
    [truckCosts],
  );
  const maxCost = topTrucks.length ? Number(topTrucks[0].totalCost) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card
        className="xl:col-span-2"
        title="Custo mensal da operação"
        subtitle="Gastos e manutenções lançados nos últimos 6 meses"
        action={
          <Link to="/relatorios" className={linkClass}>
            Ver relatórios
          </Link>
        }
      >
        {trendLoading ? (
          <div className="h-64 animate-pulse rounded-lg bg-slate-100 sm:h-72" />
        ) : (
          <CostPerKmTrendChart months={trendMonths} />
        )}
      </Card>

      <Card
        title="Veículos que mais custam"
        subtitle="Últimos 6 meses"
        action={
          <Link to="/relatorios" className={linkClass}>
            Detalhar
          </Link>
        }
      >
        {truckCostsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : topTrucks.length === 0 ? (
          <p className="flex h-48 items-center justify-center px-4 text-center text-sm text-text-secondary">
            Sem custos por veículo neste período.
          </p>
        ) : (
          <ol className="space-y-3.5">
            {topTrucks.map((t, i) => {
              const pct = maxCost > 0 ? Math.max(4, Math.round((Number(t.totalCost) / maxCost) * 100)) : 0;
              return (
                <li key={t.caminhaoId ?? t.placa}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <Link
                      to={`/caminhao/${encodeURIComponent(t.placa)}`}
                      className="plate hover:border-secondary"
                    >
                      {t.placa}
                    </Link>
                    <span className="tabular-nums">
                      <span className="font-semibold text-text-primary">{formatCurrency(t.totalCost)}</span>
                      {t.costPerKm != null && !t.kmDataInsufficient ? (
                        <span className="ml-2 text-xs text-text-secondary">
                          {Number(t.costPerKm).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/km
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <div
                      className={`h-full rounded-full ${i === 0 ? "bg-primary" : "bg-slate-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}

DashboardCharts.propTypes = {
  trendMonths: PropTypes.array,
  trendLoading: PropTypes.bool,
  truckCosts: PropTypes.array,
  truckCostsLoading: PropTypes.bool,
};
