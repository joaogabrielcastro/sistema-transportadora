import React from "react";
import PropTypes from "prop-types";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

export default function CostPerKmTrendChart({ months = [] }) {
  const labels = months.map((m) => m.month);
  const costs = months.map((m) => Number(m.totalCost || 0));
  const cpk = months.map((m) =>
    m.costPerKm == null ? null : Number(m.costPerKm),
  );

  const data = {
    labels,
    datasets: [
      {
        label: "Custo total (R$)",
        data: costs,
        borderColor: "#3B82F6",
        backgroundColor: "rgba(59,130,246,0.12)",
        fill: true,
        tension: 0.3,
        yAxisID: "y",
      },
      {
        label: "Custo/km (R$)",
        data: cpk,
        borderColor: "#0F172A",
        backgroundColor: "transparent",
        tension: 0.3,
        yAxisID: "y1",
        spanGaps: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "bottom" },
    },
    scales: {
      y: {
        type: "linear",
        position: "left",
        title: { display: true, text: "Custo R$" },
      },
      y1: {
        type: "linear",
        position: "right",
        grid: { drawOnChartArea: false },
        title: { display: true, text: "R$/km" },
      },
    },
  };

  if (!months.length) {
    return (
      <p className="text-sm text-slate-500 py-8 text-center">
        Sem dados no período para montar a tendência.
      </p>
    );
  }

  return (
    <div className="h-72">
      <Line data={data} options={options} />
    </div>
  );
}

CostPerKmTrendChart.propTypes = {
  months: PropTypes.array,
};
