import React from "react";
import PropTypes from "prop-types";
import { Chart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { formatCurrency } from "../../utils/formatters.js";

ChartJS.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-08" → "ago/26" */
function formatMonthLabel(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})/);
  if (!m) return String(value || "");
  return `${MONTHS_PT[Number(m[2]) - 1] || m[2]}/${m[1].slice(2)}`;
}

const compactCurrency = (value) => {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1000) {
    return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return `R$ ${n.toLocaleString("pt-BR")}`;
};

/**
 * Custo mensal (barras) e custo por km (linha, eixo à direita). A linha e o
 * eixo R$/km só aparecem quando há quilometragem suficiente no período.
 */
export default function CostPerKmTrendChart({ months = [] }) {
  if (!months.length) {
    return (
      <p className="py-8 text-center text-sm text-text-secondary">
        Sem dados no período para montar a tendência.
      </p>
    );
  }

  const labels = months.map((m) => formatMonthLabel(m.month));
  const costs = months.map((m) => Number(m.totalCost || 0));
  const cpk = months.map((m) => (m.costPerKm == null ? null : Number(m.costPerKm)));
  const hasCpk = cpk.some((v) => v != null && Number.isFinite(v));

  const datasets = [
    {
      type: "bar",
      label: "Custo total",
      data: costs,
      backgroundColor: "rgba(8, 145, 178, 0.85)",
      hoverBackgroundColor: "#0E7490",
      borderRadius: 6,
      maxBarThickness: 44,
      yAxisID: "y",
      order: 2,
    },
  ];
  if (hasCpk) {
    datasets.push({
      type: "line",
      label: "Custo por km",
      data: cpk,
      borderColor: "#0B1324",
      backgroundColor: "#0B1324",
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.3,
      yAxisID: "y1",
      spanGaps: true,
      order: 1,
    });
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: hasCpk,
        position: "bottom",
        labels: { usePointStyle: true, boxWidth: 8, padding: 16, color: "#5B6779" },
      },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            ctx.dataset.yAxisID === "y1"
              ? `${ctx.dataset.label}: ${ctx.raw == null ? "—" : `R$ ${Number(ctx.raw).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/km`}`
              : `${ctx.dataset.label}: ${formatCurrency(ctx.raw || 0)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#5B6779" } },
      y: {
        type: "linear",
        position: "left",
        beginAtZero: true,
        border: { display: false },
        grid: { color: "rgba(15, 23, 42, 0.06)" },
        ticks: { color: "#8A96A8", callback: compactCurrency, maxTicksLimit: 6 },
      },
      ...(hasCpk
        ? {
            y1: {
              type: "linear",
              position: "right",
              beginAtZero: true,
              border: { display: false },
              grid: { drawOnChartArea: false },
              ticks: {
                color: "#8A96A8",
                callback: (v) => `R$ ${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}/km`,
                maxTicksLimit: 6,
              },
            },
          }
        : {}),
    },
  };

  return (
    <div>
      <div className="h-64 sm:h-72">
        <Chart type="bar" data={{ labels, datasets }} options={options} />
      </div>
      {!hasCpk ? (
        <p className="mt-2 text-xs text-text-secondary">
          Custo por km indisponível: lance a quilometragem nos abastecimentos para calcular.
        </p>
      ) : null}
    </div>
  );
}

CostPerKmTrendChart.propTypes = {
  months: PropTypes.array,
};
