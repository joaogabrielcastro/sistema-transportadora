import React, { useMemo } from "react";
import PropTypes from "prop-types";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

const BRAND = {
  primary: "#0F172A",
  secondary: "#0891B2",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  muted: "#94A3B8",
};

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      labels: { boxWidth: 12, font: { size: 11 } },
    },
  },
};

function ChartShell({ title, subtitle, children, empty }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border/80 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>
        ) : null}
      </div>
      <div className="relative min-h-[180px] flex-1">
        {empty ? (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-text-secondary">
            {empty}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

ChartShell.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node,
  empty: PropTypes.string,
};

/** Km agregados por veículo (telemetry_daily / efficiency). */
export function KmByVehicleChart({ vehicles = [] }) {
  const sorted = useMemo(
    () =>
      [...vehicles]
        .filter((v) => Number(v.km) > 0)
        .sort((a, b) => Number(b.km) - Number(a.km))
        .slice(0, 8),
    [vehicles],
  );

  const data = {
    labels: sorted.map((v) => v.placa || `#${v.caminhao_id}`),
    datasets: [
      {
        label: "Km no período",
        data: sorted.map((v) => Number(Number(v.km).toFixed(1))),
        backgroundColor: BRAND.primary,
        borderRadius: 6,
        maxBarThickness: 40,
      },
    ],
  };

  return (
    <ChartShell
      title="Quilometragem por veículo"
      subtitle="Total estimado no período selecionado"
      empty={!sorted.length ? "Sem km agregados neste período." : null}
    >
      <Bar
        data={data}
        options={{
          ...chartDefaults,
          plugins: { ...chartDefaults.plugins, legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: "km" },
              grid: { color: "rgba(148,163,184,.25)" },
            },
            x: { grid: { display: false } },
          },
        }}
      />
    </ChartShell>
  );
}

KmByVehicleChart.propTypes = {
  vehicles: PropTypes.array,
};

/**
 * Velocidade ao longo do tempo (histórico GPS).
 * Faz downsample para não poluir o gráfico.
 */
export function SpeedTimelineChart({
  points = [],
  title = "Velocidade no trajeto",
  subtitle = "Evolução km/h ao longo do período",
}) {
  const series = useMemo(() => {
    if (!points.length) return { labels: [], speeds: [] };
    const maxPoints = 80;
    const step = Math.max(1, Math.ceil(points.length / maxPoints));
    const sampled = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    return {
      labels: sampled.map((p) => {
        try {
          return new Date(p.when || p.registrado_em).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          return "";
        }
      }),
      speeds: sampled.map((p) => {
        const v = p.speedKmh ?? p.velocidade_kmh;
        return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
      }),
    };
  }, [points]);

  const hasData = series.speeds.some((v) => v != null);

  const data = {
    labels: series.labels,
    datasets: [
      {
        label: "km/h",
        data: series.speeds,
        borderColor: BRAND.secondary,
        backgroundColor: "rgba(8,145,178,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 3,
        spanGaps: true,
      },
    ],
  };

  return (
    <ChartShell
      title={title}
      subtitle={subtitle}
      empty={!hasData ? "Sem leituras de velocidade neste período." : null}
    >
      <Line
        data={data}
        options={{
          ...chartDefaults,
          interaction: { mode: "index", intersect: false },
          plugins: { ...chartDefaults.plugins, legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: "km/h" },
              grid: { color: "rgba(148,163,184,.25)" },
            },
            x: {
              ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
              grid: { display: false },
            },
          },
        }}
      />
    </ChartShell>
  );
}

SpeedTimelineChart.propTypes = {
  points: PropTypes.array,
  title: PropTypes.string,
  subtitle: PropTypes.string,
};
