// frontend/src/components/DashboardStats.jsx
import React from "react";
import StatCard from "./StatCard";

const DashboardStats = ({ stats, icons }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        icon={icons.truck}
        value={stats.totalCaminhoes}
        label="Caminhões na frota"
        color="blue"
      />
      <StatCard
        icon={icons.money}
        value={`R$ ${stats.totalGastos.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })}`}
        label="Total em gastos"
        color="green"
      />
      <StatCard
        icon={icons.tools}
        value={stats.totalManutencoes}
        label="Manutenções realizadas"
        color="purple"
      />
      <StatCard
        icon={icons.chart}
        value={`R$ ${stats.mediaGastos.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })}`}
        label="Média por gasto"
        color="orange"
      />
    </div>
  );
};

export default DashboardStats;
