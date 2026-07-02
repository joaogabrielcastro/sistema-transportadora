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

const CostPerKmBarChart = ({ reportData }) => (
  <div className="h-64 mb-6">
    <Bar
      data={{
        labels: reportData.map((r) => r.placa),
        datasets: [
          {
            label: "Custo Total (R$)",
            data: reportData.map((r) => r.totalCost),
            backgroundColor: "rgba(59, 130, 246, 0.6)",
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
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
