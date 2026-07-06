import React, { useMemo } from "react";
import PropTypes from "prop-types";
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { Card } from "../ui";

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: "top", labels: { usePointStyle: true, padding: 20 } },
    tooltip: {
      callbacks: {
        label: (context) => {
          const value = context.raw || 0;
          return `R$ ${Number(value).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}`;
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: (value) => `R$ ${Number(value || 0).toLocaleString("pt-BR")}`,
      },
      grid: { color: "rgba(0, 0, 0, 0.05)" },
    },
    x: { grid: { display: false } },
  },
};

const CaminhaoAnalysisCharts = ({ gastos = [], checklists = [], registros = [] }) => {
  const gastosChartData = useMemo(() => {
    const monthlyData = {};
    registros.forEach((registro) => {
      if (registro.valor > 0) {
        const date = new Date(registro.data);
        const month = date.toLocaleString("pt-BR", {
          month: "short",
          year: "numeric",
        });
        monthlyData[month] = (monthlyData[month] || 0) + registro.valor;
      }
    });

    return {
      labels: Object.keys(monthlyData),
      datasets: [
        {
          label: "Gastos Mensais (R$)",
          data: Object.values(monthlyData),
          backgroundColor: "rgba(59, 130, 246, 0.6)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          borderRadius: 6,
        },
      ],
    };
  }, [registros]);

  const gastosLineChartData = useMemo(() => {
    const sortedRegistros = [...registros]
      .filter((r) => r.valor > 0)
      .sort((a, b) => new Date(a.data) - new Date(b.data));

    const dates = sortedRegistros.map((r) =>
      new Date(r.data).toLocaleDateString("pt-BR"),
    );
    const cumulativeData = [];
    let cumulativeTotal = 0;

    sortedRegistros.forEach((registro) => {
      cumulativeTotal += registro.valor;
      cumulativeData.push(cumulativeTotal);
    });

    return {
      labels: dates,
      datasets: [
        {
          label: "Gastos Acumulados (R$)",
          data: cumulativeData,
          fill: true,
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgba(59, 130, 246, 1)",
          borderWidth: 2,
          tension: 0.3,
          pointBackgroundColor: "rgba(59, 130, 246, 1)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 4,
        },
      ],
    };
  }, [registros]);

  const gastosPorTipoData = useMemo(() => {
    const tipoData = {};

    gastos.forEach((gasto) => {
      if (gasto.valor) {
        const tipo = `Gasto: ${gasto.tipos_gastos?.nome_tipo || "Outros"}`;
        tipoData[tipo] = (tipoData[tipo] || 0) + parseFloat(gasto.valor);
      }
    });

    checklists.forEach((checklist) => {
      if (checklist.valor) {
        const tipo = `Manutenção: ${
          checklist.itens_checklist?.nome_item || "Outros"
        }`;
        tipoData[tipo] = (tipoData[tipo] || 0) + parseFloat(checklist.valor);
      }
    });

    const cores = [
      "rgba(59, 130, 246, 0.8)",
      "rgba(16, 185, 129, 0.8)",
      "rgba(245, 158, 11, 0.8)",
      "rgba(239, 68, 68, 0.8)",
      "rgba(139, 92, 246, 0.8)",
      "rgba(14, 165, 233, 0.8)",
    ];

    return {
      labels: Object.keys(tipoData),
      datasets: [
        {
          data: Object.values(tipoData),
          backgroundColor: cores.slice(0, Object.keys(tipoData).length),
          borderWidth: 0,
        },
      ],
    };
  }, [gastos, checklists]);

  if (registros.length === 0) {
    return (
      <p className="text-sm text-text-secondary text-center py-8">
        Sem dados suficientes para gráficos neste caminhão.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card title="Gastos Mensais">
        <div className="h-80">
          <Bar options={chartOptions} data={gastosChartData} />
        </div>
      </Card>
      <Card title="Evolução de Gastos">
        <div className="h-80">
          <Line options={chartOptions} data={gastosLineChartData} />
        </div>
      </Card>
      {gastosPorTipoData.labels.length > 0 && (
        <Card title="Distribuição por Tipo" className="lg:col-span-2">
          <div className="h-80 max-w-xl mx-auto">
            <Doughnut
              options={{
                ...chartOptions,
                scales: undefined,
                plugins: {
                  ...chartOptions.plugins,
                  legend: { position: "right" },
                },
              }}
              data={gastosPorTipoData}
            />
          </div>
        </Card>
      )}
    </div>
  );
};

CaminhaoAnalysisCharts.propTypes = {
  gastos: PropTypes.arrayOf(PropTypes.object),
  checklists: PropTypes.arrayOf(PropTypes.object),
  registros: PropTypes.arrayOf(PropTypes.object),
};

export default CaminhaoAnalysisCharts;
