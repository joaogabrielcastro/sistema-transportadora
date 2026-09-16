import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import { Card } from "../ui";
import CostPerKmTrendChart from "../relatorios/CostPerKmTrendChart.jsx";
import { formatCurrency } from "../../utils/formatters.js";

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const TIPO_LABEL = {
  truck: "Trucks",
  cavalo: "Cavalos",
  carreta: "Carretas",
};

const FROTA_COLORS = ["#2563EB", "#0F766E", "#D97706", "#64748B"];

function ChartEmpty({ text }) {
  return (
    <p className="flex h-56 items-center justify-center px-4 text-center text-sm text-text-secondary">
      {text}
    </p>
  );
}

export default function DashboardCharts({
  overview,
  trendMonths = [],
  trendLoading = false,
  truckCosts = [],
  truckCostsLoading = false,
}) {
  const frotaData = useMemo(() => {
    const rows = Array.isArray(overview?.frotaPorTipo) ? overview.frotaPorTipo : [];
    const labels = rows.map(
      (row) => TIPO_LABEL[row.tipo] || String(row.tipo || "Outros"),
    );
    const values = rows.map((row) => Number(row.count || 0));
    return { labels, values };
  }, [overview]);

  const custoSplit = useMemo(() => {
    const gastos = Number(overview?.gastosValor || 0);
    const manutencoes = Number(overview?.manutencoesValor || 0);
    return {
      gastos,
      manutencoes,
      hasData: gastos > 0 || manutencoes > 0,
    };
  }, [overview]);

  const topTrucks = useMemo(
    () =>
      (Array.isArray(truckCosts) ? truckCosts : [])
        .filter((item) => Number(item.totalCost) > 0)
        .slice(0, 8),
    [truckCosts],
  );

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true, padding: 16 } },
    },
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card
        className="lg:col-span-2"
        title="Evolução de custos"
        subtitle="Gastos e manutenções nos últimos 6 meses"
        action={
          <Link to="/relatorios" className="text-sm font-medium text-secondary">
            Ver relatórios
          </Link>
        }
      >
        {trendLoading ? (
          <div className="h-72 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <CostPerKmTrendChart months={trendMonths} />
        )}
      </Card>

      <Card
        title="Composição da frota"
        subtitle={
          overview?.comMotorista != null
            ? `${overview.comMotorista} com motorista · ${overview.semMotorista || 0} sem motorista`
            : "Por tipo de veículo"
        }
      >
        {frotaData.values.some((n) => n > 0) ? (
          <div className="h-56">
            <Doughnut
              data={{
                labels: frotaData.labels,
                datasets: [
                  {
                    data: frotaData.values,
                    backgroundColor: FROTA_COLORS.slice(0, frotaData.labels.length),
                    borderWidth: 0,
                  },
                ],
              }}
              options={doughnutOptions}
            />
          </div>
        ) : (
          <ChartEmpty text="Cadastre veículos para ver a composição da frota." />
        )}
      </Card>

      <Card
        title="Gastos × manutenção"
        subtitle="Valores lançados na operação"
      >
        {custoSplit.hasData ? (
          <div className="h-56">
            <Doughnut
              data={{
                labels: ["Gastos", "Manutenções"],
                datasets: [
                  {
                    data: [custoSplit.gastos, custoSplit.manutencoes],
                    backgroundColor: ["#2563EB", "#EA580C"],
                    borderWidth: 0,
                  },
                ],
              }}
              options={{
                ...doughnutOptions,
                plugins: {
                  ...doughnutOptions.plugins,
                  tooltip: {
                    callbacks: {
                      label: (ctx) =>
                        `${ctx.label}: ${formatCurrency(ctx.raw || 0)}`,
                    },
                  },
                },
              }}
            />
          </div>
        ) : (
          <ChartEmpty text="Sem lançamentos de gasto ou manutenção ainda." />
        )}
      </Card>

      <Card
        className="lg:col-span-2"
        title="Custo por veículo"
        subtitle="Maiores custos no período"
        action={
          <Link to="/relatorios" className="text-sm font-medium text-secondary">
            Detalhar
          </Link>
        }
      >
        {truckCostsLoading ? (
          <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
        ) : topTrucks.length > 0 ? (
          <div className="h-64">
            <Bar
              data={{
                labels: topTrucks.map((item) => item.placa),
                datasets: [
                  {
                    label: "Custo total (R$)",
                    data: topTrucks.map((item) => Number(item.totalCost || 0)),
                    backgroundColor: "rgba(37, 99, 235, 0.7)",
                    borderRadius: 6,
                  },
                ],
              }}
              options={{
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
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) =>
                        `R$ ${Number(value || 0).toLocaleString("pt-BR")}`,
                    },
                    grid: { color: "rgba(0, 0, 0, 0.05)" },
                  },
                  x: { grid: { display: false } },
                },
              }}
            />
          </div>
        ) : (
          <ChartEmpty text="Sem custos por veículo neste período." />
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
