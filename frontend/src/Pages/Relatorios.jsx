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
  SearchableSelect,
  LoadingSpinner,
  PageHeader,
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableTh,
  DataTableTd,
  FilterChips,
} from "../components/ui";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { exportToPDF, exportToExcel } from "../utils/exportUtils";
import { formatCurrency, formatNumber, formatDate } from "../utils/formatters";

const tipoLabels = {
  gasto: "Gasto",
  manutencao: "Manutenção",
};

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
  const reportEntries = report?.entries ?? [];
  const hasReport = reportData.length > 0 || reportEntries.length > 0;
  const stats = report?.stats ?? {
    grandTotal: 0,
    totalKm: 0,
    avgCostPerKm: 0,
    truckCount: 0,
    entryCount: 0,
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

  const activeFilterChips = useMemo(() => {
    if (!submittedParams) return [];

    const chips = [
      {
        key: "start",
        label: "De",
        value: formatDate(submittedParams.startDate),
        removable: false,
      },
      {
        key: "end",
        label: "Até",
        value: formatDate(submittedParams.endDate),
        removable: false,
      },
    ];

    if (submittedParams.caminhaoId) {
      const caminhao = caminhoes.find((c) => c.id === submittedParams.caminhaoId);
      chips.push({
        key: "caminhao",
        label: "Caminhão",
        value: caminhao
          ? `${caminhao.placa}${caminhao.modelo ? ` — ${caminhao.modelo}` : ""}`
          : String(submittedParams.caminhaoId),
      });
    } else {
      chips.push({
        key: "caminhao",
        label: "Caminhão",
        value: "Todos",
        removable: false,
      });
    }

    return chips;
  }, [submittedParams, caminhoes]);

  const handleRemoveFilter = (key) => {
    if (key === "caminhao") {
      setSelectedCaminhao("");
      if (submittedParams) {
        setSubmittedParams({
          ...submittedParams,
          caminhaoId: undefined,
        });
      }
    }
  };

  const handleExportPDF = async () => {
    const summaryColumns = [
      "Placa",
      "Total Gasto",
      "KM Rodado (Estimado)",
      "Custo Médio / KM",
    ];
    const summaryRows = reportData.map((r) => [
      r.placa,
      formatCurrency(r.totalCost),
      r.kmDriven === "N/I" ? "Dados Insuf." : `${r.kmDriven} km`,
      r.kmDriven === "N/I" ? "-" : formatCurrency(r.costPerKm),
    ]);
    const detailColumns = [
      "Data",
      "Placa",
      "Tipo",
      "Descrição",
      "Valor",
      "KM",
    ];
    const detailRows = reportEntries.map((entry) => [
      formatDate(entry.data),
      entry.placa,
      tipoLabels[entry.tipo] || entry.tipo,
      entry.descricao,
      formatCurrency(entry.valor),
      entry.km ?? "—",
    ]);

    setExporting("pdf");
    try {
      await exportToPDF(
        "Relatório de Custo Operacional — Resumo",
        summaryColumns,
        summaryRows,
      );
      if (detailRows.length > 0) {
        await exportToPDF(
          "Relatório de Custo Operacional — Detalhamento",
          detailColumns,
          detailRows,
          "relatorio_detalhamento.pdf",
        );
      }
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    const summary = reportData.map((r) => ({
      Placa: r.placa,
      "Total Gasto": r.totalCost,
      "KM Rodado (Estimado)": r.kmDriven,
      "Custo / KM": r.costPerKm,
    }));
    const detail = reportEntries.map((entry) => ({
      Data: formatDate(entry.data),
      Placa: entry.placa,
      Tipo: tipoLabels[entry.tipo] || entry.tipo,
      Descrição: entry.descricao,
      Valor: entry.valor,
      KM: entry.km ?? "",
    }));
    const data =
      detail.length > 0
        ? [
            ...summary.map((row) => ({ Aba: "Resumo", ...row })),
            ...detail.map((row) => ({ Aba: "Detalhamento", ...row })),
          ]
        : summary;

    setExporting("excel");
    try {
      await exportToExcel(data, "relatorio_custos.xlsx");
    } finally {
      setExporting(null);
    }
  };

  return (
    <PageLayout className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Início", to: "/" }, { label: "Relatórios" }]}
      />
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
            <SearchableSelect
              label="Caminhão (opcional)"
              name="caminhao"
              value={selectedCaminhao}
              onChange={setSelectedCaminhao}
              disabled={loadingCaminhoes}
              options={caminhaoOptions}
              placeholder="Buscar por placa ou modelo..."
            />
            <Button onClick={generateReport} loading={loading}>
              Gerar Relatório
            </Button>
          </div>
        </Card>

        {submittedParams && (
          <FilterChips
            items={activeFilterChips}
            onRemove={handleRemoveFilter}
          />
        )}

        {hasReport && (
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

              <div className="md:hidden divide-y divide-border">
                {reportData.map((row) => (
                  <div key={row.placa} className="px-4 py-3 space-y-1">
                    <p className="font-semibold text-text-primary">{row.placa}</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Total gasto</span>
                      <span className="font-medium tabular-nums">
                        {formatCurrency(row.totalCost)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">KM rodado</span>
                      <span>
                        {row.kmDriven === "N/I"
                          ? "Dados insuficientes"
                          : `${formatNumber(row.kmDriven)} km`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Custo / KM</span>
                      <span className="font-medium tabular-nums">
                        {row.kmDriven === "N/I"
                          ? "—"
                          : formatCurrency(row.costPerKm)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <DataTable className="hidden md:table">
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

            {reportEntries.length > 0 && (
              <Card noPadding>
                <div className="px-5 py-4 border-b border-border">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Detalhamento dos lançamentos
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">
                    {stats.entryCount} registro(s) no período. Manutenções com
                    R$ 0,00 aparecem aqui, mas não entram no custo total.
                  </p>
                </div>

                <div className="md:hidden divide-y divide-border">
                  {reportEntries.map((entry) => (
                    <div
                      key={`${entry.tipo}-${entry.id}-m`}
                      className="px-4 py-3 space-y-1"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-text-primary">
                          {entry.placa}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {formatDate(entry.data)}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary">
                        {tipoLabels[entry.tipo] || entry.tipo} · {entry.descricao}
                      </p>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium tabular-nums">
                          {formatCurrency(entry.valor)}
                        </span>
                        <span className="text-text-secondary">
                          {entry.km != null
                            ? `${formatNumber(entry.km)} km`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <DataTable className="hidden md:table">
                  <DataTableHead>
                    <tr>
                      <DataTableTh width="12%">Data</DataTableTh>
                      <DataTableTh width="12%">Placa</DataTableTh>
                      <DataTableTh width="14%">Tipo</DataTableTh>
                      <DataTableTh width="34%">Descrição</DataTableTh>
                      <DataTableTh width="14%" align="right">
                        Valor
                      </DataTableTh>
                      <DataTableTh width="14%" align="right">
                        KM
                      </DataTableTh>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {reportEntries.map((entry) => (
                      <DataTableRow
                        key={`${entry.tipo}-${entry.id}`}
                      >
                        <DataTableTd className="whitespace-nowrap">
                          {formatDate(entry.data)}
                        </DataTableTd>
                        <DataTableTd className="font-semibold whitespace-nowrap">
                          {entry.placa}
                        </DataTableTd>
                        <DataTableTd className="whitespace-nowrap">
                          {tipoLabels[entry.tipo] || entry.tipo}
                        </DataTableTd>
                        <DataTableTd>{entry.descricao}</DataTableTd>
                        <DataTableTd
                          align="right"
                          className="whitespace-nowrap tabular-nums"
                        >
                          {formatCurrency(entry.valor)}
                        </DataTableTd>
                        <DataTableTd
                          align="right"
                          className="whitespace-nowrap tabular-nums"
                        >
                          {entry.km != null
                            ? `${formatNumber(entry.km)} km`
                            : "—"}
                        </DataTableTd>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </Card>
            )}
          </div>
        )}

        {erroCaminhoes && (
          <Alert
            type="warning"
            message="Não foi possível carregar a lista de caminhões para o filtro."
          />
        )}

        {submittedParams && !loading && !hasReport && (
          <Alert
            type="info"
            message="Nenhum dado encontrado para o período e filtros selecionados."
          />
        )}
    </PageLayout>
  );
};

export default Relatorios;
