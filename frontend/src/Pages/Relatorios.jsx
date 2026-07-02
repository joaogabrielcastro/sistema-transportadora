import React, { useState } from "react";
import {
  useCaminhoesListQuery,
  useCostPerKmReportQuery,
} from "../hooks";
import { API_CONFIG } from "../utils/constants.js";
import {
  Card,
  Button,
  Alert,
  FormField,
} from "../components/ui";
import { exportToPDF, exportToExcel } from "../utils/exportUtils";
import { formatCurrency, formatNumber } from "../utils/formatters";
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

const Relatorios = () => {
  const [selectedCaminhao, setSelectedCaminhao] = useState("");
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [submittedParams, setSubmittedParams] = useState(null);

  const { data: caminhoesPage } = useCaminhoesListQuery({
    page: 1,
    limit: API_CONFIG.LIST_MAX,
  });

  const caminhoes = caminhoesPage?.data ?? [];

  const {
    data: report,
    isFetching: loading,
  } = useCostPerKmReportQuery(submittedParams ?? {}, Boolean(submittedParams));

  const reportData = report?.items ?? [];
  const stats = report?.stats ?? {
    grandTotal: 0,
    totalKm: 0,
    avgCostPerKm: 0,
    truckCount: 0,
  };

  const generateReport = () => {
    setSubmittedParams({
      startDate: dateRange.start,
      endDate: dateRange.end,
      caminhaoId: selectedCaminhao || undefined,
    });
  };

  const handleExportPDF = () => {
    const columns = [
      "Placa",
      "Total Gasto",
      "KM Rodado (Estimado)",
      "Custo Médio / KM",
    ];
    const rows = reportData.map((r) => [
      r.placa,
      formatCurrency(r.totalCost),
      r.kmDriven === "N/I" ? "Dados Insuf." : `${r.kmDriven} km`,
      r.kmDriven === "N/I" ? "-" : formatCurrency(r.costPerKm),
    ]);
    exportToPDF("Relatório de Custo Operacional", columns, rows);
  };

  const handleExportExcel = () => {
    const data = reportData.map((r) => ({
      Placa: r.placa,
      "Total Gasto": r.totalCost,
      "KM Rodado (Estimado)": r.kmDriven,
      "Custo / KM": r.costPerKm,
    }));
    exportToExcel(data, "relatorio_custos.xlsx");
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Relatórios Gerenciais
          </h1>
          <p className="text-gray-600">
            Análise de custos e eficiência da frota.
          </p>
        </div>

        <Card>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <FormField
              label="Data Inicial"
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
            />
            <FormField
              label="Data Final"
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
            />
            <FormField
              label="Caminhão (Opcional)"
              type="select"
              value={selectedCaminhao}
              onChange={(e) => setSelectedCaminhao(e.target.value)}
              options={[
                { value: "", label: "Todos" },
                ...caminhoes.map((c) => ({ value: c.id, label: c.placa })),
              ]}
            />
            <Button onClick={generateReport} loading={loading}>
              Gerar Relatório
            </Button>
          </div>
        </Card>

        {reportData.length > 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-blue-50 border-blue-100">
                <div className="text-blue-600 font-medium mb-1">
                  Custo Total
                </div>
                <div className="text-2xl font-bold text-blue-800">
                  {formatCurrency(stats.grandTotal)}
                </div>
              </Card>
              <Card className="bg-green-50 border-green-100">
                <div className="text-green-600 font-medium mb-1">
                  KM Total (Est.)
                </div>
                <div className="text-2xl font-bold text-green-800">
                  {formatNumber(stats.totalKm)} km
                </div>
              </Card>
              <Card className="bg-purple-50 border-purple-100">
                <div className="text-purple-600 font-medium mb-1">
                  Custo Médio / KM
                </div>
                <div className="text-2xl font-bold text-purple-800">
                  {formatCurrency(stats.avgCostPerKm)}
                </div>
              </Card>
            </div>

            <div className="flex gap-4 justify-end">
              <Button variant="outline" onClick={handleExportPDF}>
                Exportar PDF
              </Button>
              <Button variant="outline" onClick={handleExportExcel}>
                Exportar Excel
              </Button>
            </div>

            <Card>
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                Custo por Caminhão
              </h3>
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

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Placa
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total Gasto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        KM Rodado (Est.)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Custo / KM
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.map((row) => (
                      <tr key={row.placa}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">
                          {row.placa}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatCurrency(row.totalCost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {row.kmDriven === "N/I"
                            ? "Dados Insuficientes"
                            : `${formatNumber(row.kmDriven)} km`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {row.kmDriven === "N/I"
                            ? "-"
                            : formatCurrency(row.costPerKm)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {submittedParams && !loading && reportData.length === 0 && (
          <Alert
            type="info"
            message="Nenhum dado encontrado para o período e filtros selecionados."
          />
        )}
      </div>
    </div>
  );
};

export default Relatorios;
