import React, { lazy, Suspense, useState, useMemo } from "react";
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
  LoadingSpinner,
  PageHeader,
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableTh,
  DataTableTd,
} from "../components/ui";
import PageLayout from "../components/layout/PageLayout.jsx";
import { exportToPDF, exportToExcel } from "../utils/exportUtils";
import { formatCurrency, formatNumber } from "../utils/formatters";

const CostPerKmBarChart = lazy(
  () => import("../components/relatorios/CostPerKmBarChart.jsx"),
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
  const [exporting, setExporting] = useState(null);

  const {
    data: caminhoesPage,
    isLoading: loadingCaminhoes,
    error: erroCaminhoes,
  } = useCaminhoesListQuery({
    page: 1,
    limit: API_CONFIG.LIST_MAX,
  });

  const caminhoes = caminhoesPage?.data ?? [];

  const caminhaoOptions = useMemo(
    () => [
      { value: "", label: "Todos os caminhões" },
      ...caminhoes.map((c) => ({
        value: String(c.id),
        label: `${c.placa}${c.modelo ? ` — ${c.modelo}` : ""}`,
      })),
    ],
    [caminhoes],
  );

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
      caminhaoId: selectedCaminhao
        ? parseInt(selectedCaminhao, 10)
        : undefined,
    });
  };

  const handleExportPDF = async () => {
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

    setExporting("pdf");
    try {
      await exportToPDF("Relatório de Custo Operacional", columns, rows);
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    const data = reportData.map((r) => ({
      Placa: r.placa,
      "Total Gasto": r.totalCost,
      "KM Rodado (Estimado)": r.kmDriven,
      "Custo / KM": r.costPerKm,
    }));

    setExporting("excel");
    try {
      await exportToExcel(data, "relatorio_custos.xlsx");
    } finally {
      setExporting(null);
    }
  };

  return (
    <PageLayout className="space-y-6">
      <PageHeader
        title="Relatórios Gerenciais"
        subtitle="Análise de custos e eficiência da frota"
      />

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
              label="Caminhão (opcional)"
              type="select"
              value={selectedCaminhao}
              onChange={(e) => setSelectedCaminhao(e.target.value)}
              disabled={loadingCaminhoes}
              options={caminhaoOptions}
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
              <Button
                variant="outline"
                onClick={handleExportPDF}
                loading={exporting === "pdf"}
                disabled={Boolean(exporting)}
              >
                Exportar PDF
              </Button>
              <Button
                variant="outline"
                onClick={handleExportExcel}
                loading={exporting === "excel"}
                disabled={Boolean(exporting)}
              >
                Exportar Excel
              </Button>
            </div>

            <Card noPadding>
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-lg font-semibold text-text-primary">
                  Custo por Caminhão
                </h3>
              </div>
              <div className="p-5">
                <Suspense
                  fallback={
                    <div className="h-64 mb-6 flex items-center justify-center">
                      <LoadingSpinner text="Carregando gráfico..." />
                    </div>
                  }
                >
                  <CostPerKmBarChart reportData={reportData} />
                </Suspense>
              </div>

              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTableTh width="20%">Placa</DataTableTh>
                    <DataTableTh width="25%" align="right">
                      Total Gasto
                    </DataTableTh>
                    <DataTableTh width="30%" align="right">
                      KM Rodado (Est.)
                    </DataTableTh>
                    <DataTableTh width="25%" align="right">
                      Custo / KM
                    </DataTableTh>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {reportData.map((row) => (
                    <DataTableRow key={row.placa}>
                      <DataTableTd className="font-semibold whitespace-nowrap">
                        {row.placa}
                      </DataTableTd>
                      <DataTableTd align="right" className="whitespace-nowrap tabular-nums">
                        {formatCurrency(row.totalCost)}
                      </DataTableTd>
                      <DataTableTd align="right" className="whitespace-nowrap">
                        {row.kmDriven === "N/I"
                          ? "Dados insuficientes"
                          : `${formatNumber(row.kmDriven)} km`}
                      </DataTableTd>
                      <DataTableTd align="right" className="font-medium whitespace-nowrap tabular-nums">
                        {row.kmDriven === "N/I"
                          ? "—"
                          : formatCurrency(row.costPerKm)}
                      </DataTableTd>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </Card>
          </div>
        )}

        {erroCaminhoes && (
          <Alert
            type="warning"
            message="Não foi possível carregar a lista de caminhões para o filtro."
          />
        )}

        {submittedParams && !loading && reportData.length === 0 && (
          <Alert
            type="info"
            message="Nenhum dado encontrado para o período e filtros selecionados."
          />
        )}
    </PageLayout>
  );
};

export default Relatorios;
