import React from "react";
import PropTypes from "prop-types";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

const compact = (value) => {
  const n = Number(value || 0);
  return n >= 1000
    ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
    : `R$ ${n.toLocaleString("pt-BR")}`;
};

/** Ranking de custo por placa (barras horizontais: placas legíveis em qualquer largura). */
const CostPerKmBarChart = ({ reportData }) => (
  <div className="mb-6" style={{ height: Math.max(160, reportData.length * 34 + 32) }}>
    <Bar
      data={{
        labels: reportData.map((r) => r.placa),
        datasets: [
          {
            label: "Custo total",
            data: reportData.map((r) => r.totalCost),
            backgroundColor: "rgba(8, 145, 178, 0.85)",
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
              label: (ctx) =>
                Number(ctx.raw || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: "rgba(15, 23, 42, 0.06)" },
            ticks: { color: "#8A96A8", callback: compact, maxTicksLimit: 6 },
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
);

CostPerKmBarChart.propTypes = {
  reportData: PropTypes.arrayOf(
    PropTypes.shape({
      placa: PropTypes.string,
      totalCost: PropTypes.number,
    }),
  ).isRequired,
};

export default CostPerKmBarChart;
