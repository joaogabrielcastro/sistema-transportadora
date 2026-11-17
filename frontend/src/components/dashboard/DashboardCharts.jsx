import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Card } from "../ui";
import CostPerKmTrendChart from "../relatorios/CostPerKmTrendChart.jsx";
import { formatCurrency, formatNumber } from "../../utils/formatters.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const TIPO_LABEL = {
  truck: "Trucks",
  cavalo: "Cavalos",
  carreta: "Carretas",
};

const TIPO_COLOR = {
  cavalo: "bg-indigo-500",
  truck: "bg-sky-500",
  carreta: "bg-amber-500",
};

function ChartEmpty({ text }) {
  return (
    <p className="flex h-48 items-center justify-center px-4 text-center text-sm text-text-secondary">
      {text}
    </p>
  );
}

ChartEmpty.propTypes = { text: PropTypes.string };

/** Barra de proporção com rótulo, valor e percentual — leitura direta, sem rosca. */
function ShareRow({ label, value, total, color, format = formatNumber }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-text-primary">
          <span className={`h-2.5 w-2.5 rounded-sm ${color}`} aria-hidden />
          {label}
        </span>
        <span className="tabular-nums">
          <span className="font-semibold text-text-primary">{format(value)}</span>
          <span className="ml-2 text-xs text-text-secondary">{pct}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

ShareRow.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
  format: PropTypes.func,
};

const linkClass =
  "rounded text-[13px] font-semibold text-secondary-dark hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary";

export default function DashboardCharts({
  overview,
  trendMonths = [],
  trendLoading = false,
  truckCosts = [],
  truckCostsLoading = false,
}) {
  const frota = useMemo(() => {
    const rows = Array.isArray(overview?.frotaPorTipo) ? overview.frotaPorTipo : [];
    const items = rows.map((row) => ({
      tipo: row.tipo,
      label: TIPO_LABEL[row.tipo] || String(row.tipo || "Outros"),
      value: Number(row.count || 0),
    }));
    return { items, total: items.reduce((acc, i) => acc + i.value, 0) };
  }, [overview]);

  const custos = useMemo(() => {
    const gastos = Number(overview?.gastosValor || 0);
    const manutencoes = Number(overview?.manutencoesValor || 0);
    return { gastos, manutencoes, total: gastos + manutencoes };
  }, [overview]);

  const topTrucks = useMemo(
    () =>
      (Array.isArray(truckCosts) ? truckCosts : [])
        .filter((item) => Number(item.totalCost) > 0)
        .slice(0, 8),
    [truckCosts],
  );

  const comMotorista = Number(overview?.comMotorista || 0);
  const semMotorista = Number(overview?.semMotorista || 0);

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

      <Card title="Para onde vai o dinheiro" subtitle="Total lançado desde o início">
        {custos.total > 0 ? (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium text-text-secondary">Total</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
                {formatCurrency(custos.total)}
              </p>
            </div>
            <ShareRow label="Gastos operacionais" value={custos.gastos} total={custos.total} color="bg-cyan-600" format={formatCurrency} />
            <ShareRow label="Manutenções" value={custos.manutencoes} total={custos.total} color="bg-orange-500" format={formatCurrency} />
            <Link to="/manutencao-gastos" className={`inline-flex ${linkClass}`}>
              Ver lançamentos →
            </Link>
          </div>
        ) : (
          <ChartEmpty text="Sem lançamentos de gasto ou manutenção ainda." />
        )}
      </Card>

      <Card
        className="xl:col-span-2"
        title="Veículos com maior custo"
        subtitle="Últimos 6 meses — gastos + manutenções por placa"
        action={
          <Link to="/relatorios" className={linkClass}>
            Detalhar
          </Link>
        }
      >
        {truckCostsLoading ? (
          <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
        ) : topTrucks.length > 0 ? (
          <div style={{ height: Math.max(160, topTrucks.length * 34 + 24) }}>
            <Bar
              data={{
                labels: topTrucks.map((item) => item.placa),
                datasets: [
                  {
                    label: "Custo total",
                    data: topTrucks.map((item) => Number(item.totalCost || 0)),
                    backgroundColor: topTrucks.map((_, i) =>
                      i === 0 ? "#0B1324" : "rgba(11, 19, 36, 0.28)",
                    ),
                    hoverBackgroundColor: "#0E7490",
                    borderRadius: 4,
                    barThickness: 18,
                  },
                ],
              }}
              options={{
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => formatCurrency(ctx.raw || 0),
                    },
                  },
                },
                scales: {
                  x: {
                    beginAtZero: true,
                    border: { display: false },
                    ticks: {
                      color: "#8A96A8",
                      maxTicksLimit: 6,
                      callback: (value) => {
                        const n = Number(value || 0);
                        return n >= 1000 ? `R$ ${(n / 1000).toLocaleString("pt-BR")} mil` : `R$ ${n}`;
                      },
                    },
                    grid: { color: "rgba(15, 23, 42, 0.06)" },
                  },
                  y: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                      color: "#0F172A",
                      font: { family: "JetBrains Mono, ui-monospace, monospace", weight: "600" },
                    },
                  },
                },
              }}
            />
          </div>
        ) : (
          <ChartEmpty text="Sem custos por veículo neste período." />
        )}
      </Card>

      <Card
        title="Composição da frota"
        subtitle={`${formatNumber(frota.total)} veículo(s) cadastrado(s)`}
        action={
          <Link to="/frota" className={linkClass}>
            Ver frota
          </Link>
        }
      >
        {frota.total > 0 ? (
          <div className="space-y-4">
            {frota.items.map((item) => (
              <ShareRow
                key={item.tipo}
                label={item.label}
                value={item.value}
                total={frota.total}
                color={TIPO_COLOR[item.tipo] || "bg-slate-400"}
              />
            ))}
            {overview?.comMotorista != null ? (
              <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 text-center">
                <div className="rounded-lg bg-slate-50 px-2 py-2.5">
                  <p className="text-lg font-semibold tabular-nums text-text-primary">{comMotorista}</p>
                  <p className="text-xs text-text-secondary">com motorista</p>
                </div>
                <div className={`rounded-lg px-2 py-2.5 ${semMotorista > 0 ? "bg-amber-50" : "bg-slate-50"}`}>
                  <p className={`text-lg font-semibold tabular-nums ${semMotorista > 0 ? "text-amber-800" : "text-text-primary"}`}>{semMotorista}</p>
                  <p className="text-xs text-text-secondary">sem motorista</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <ChartEmpty text="Cadastre veículos para ver a composição da frota." />
        )}
      </Card>
    </div>
  );
}

DashboardCharts.propTypes = {
  overview: PropTypes.object,
  trendMonths: PropTypes.array,
  trendLoading: PropTypes.bool,
  truckCosts: PropTypes.array,
  truckCostsLoading: PropTypes.bool,
};
