import React, { useState, useEffect } from "react";
import { useApi } from "../hooks/useApi";
import {
  Card,
  Button,
  LoadingSpinner,
  Alert,
  FormField,
} from "../components/ui";
import { exportToPDF, exportToExcel } from "../utils/exportUtils";
import { formatCurrency, formatDate, formatNumber } from "../utils/formatters";
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
  const { get } = useApi();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [caminhoes, setCaminhoes] = useState([]);
  const [selectedCaminhao, setSelectedCaminhao] = useState("");
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toISOString()
      .split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchCaminhoes();
  }, []);

  const fetchCaminhoes = async () => {
    try {
      const res = await get("/caminhoes");
      const list = Array.isArray(res) ? res : res.data || [];
      setCaminhoes(list);
    } catch (error) {
      console.error("Erro ao carregar caminhões", error);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      // Fetch expenses filtered
      let url = `/gastos?limit=1000`; // In a real scenario, should support date filter in API
      if (selectedCaminhao) url += `&caminhaoId=${selectedCaminhao}`;

      const res = await get(url);

      // Ajuste robusto para extrair os dados independente do formato da resposta
      let allGastos = [];
      if (Array.isArray(res)) {
        allGastos = res;
      } else if (Array.isArray(res.data)) {
        allGastos = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        allGastos = res.data.data;
      } else if (res.data && res.data.data && Array.isArray(res.data.data)) {
        // Caso useApi envolva em { success: true, data: { data: [] } }
        allGastos = res.data.data;
      }

      console.log("Gastos carregados para relatório:", allGastos);

      // Filter by date locally since API might not support it yet
      const filteredGastos = allGastos.filter((g) => {
        const d = g.data_gasto.split("T")[0];
        return d >= dateRange.start && d <= dateRange.end;
      });

      // Process Data for "Cost per KM"
      // Group by Truck
      const truckStats = {};

      filteredGastos.forEach((g) => {
        if (!g.caminhoes) return;
        const placa = g.caminhoes.placa;

        if (!truckStats[placa]) {
          truckStats[placa] = {
            placa,
            totalCost: 0,
            minKm: Infinity,
            maxKm: -Infinity,
            expensesCount: 0,
          };
        }

        truckStats[placa].totalCost += Number(g.valor);
        truckStats[placa].expensesCount += 1;

        if (g.km_registro) {
          if (g.km_registro < truckStats[placa].minKm)
            truckStats[placa].minKm = g.km_registro;
          if (g.km_registro > truckStats[placa].maxKm)
            truckStats[placa].maxKm = g.km_registro;
        }
      });

      const processed = Object.values(truckStats).map((stat) => {
        const kmDriven =
          stat.maxKm !== -Infinity && stat.minKm !== Infinity
            ? stat.maxKm - stat.minKm
            : 0;

        const costPerKm = kmDriven > 0 ? stat.totalCost / kmDriven : 0;

        return {
          ...stat,
          kmDriven: kmDriven > 0 ? kmDriven : "N/I", // Não informado
          costPerKm,
        };
      });

      // Calculate Grand Totals
      const grandTotalCalc = processed.reduce(
        (acc, curr) => acc + curr.totalCost,
        0,
      );
      const totalKmCalc = processed.reduce(
        (acc, curr) =>
          acc + (typeof curr.kmDriven === "number" ? curr.kmDriven : 0),
        0,
      );
      const avgCostPerKmValue =
        totalKmCalc > 0 ? grandTotalCalc / totalKmCalc : 0;

      setStats({
        grandTotal: grandTotalCalc,
        totalKm: totalKmCalc,
        avgCostPerKm: avgCostPerKmValue,
        truckCount: processed.length,
      });

      setReportData(processed);
    } catch (error) {
      console.error("Erro ao gerar relatório", error);
    } finally {
      setLoading(false);
    }
  };

  const [stats, setStats] = useState({
    grandTotal: 0,
    totalKm: 0,
    avgCostPerKm: 0,
    truckCount: 0,
  });

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
              <div className="h-64">
                <Bar
                  data={{
                    labels: reportData.map((d) => d.placa),
                    datasets: [
                      {
                        label: "Custo Total (R$)",
                        data: reportData.map((d) => d.totalCost),
                        backgroundColor: "rgba(59, 130, 246, 0.5)",
                      },
                    ],
                  }}
                  options={{ maintainAspectRatio: false }}
                />
              </div>
            </Card>

            <Card title="Detalhamento">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Caminhão
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Gasto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        KM Percorrido (Est.)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Custo / KM
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                          {row.placa}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {formatCurrency(row.totalCost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {row.kmDriven === "N/I" ? (
                            <span className="text-yellow-600 text-xs bg-yellow-100 px-2 py-1 rounded">
                              Dados Insuficientes
                            </span>
                          ) : (
                            `${formatNumber(row.kmDriven)} km`
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-bold">
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
      </div>
    </div>
  );
};

export default Relatorios;
