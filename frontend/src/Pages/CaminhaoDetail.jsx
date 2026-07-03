import React, { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useCaminhaoDetailQuery, usePneuAtribuirQueries } from "../hooks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys.js";
import { API_CONFIG } from "../utils/constants.js";
import { Card, Button, Alert, PageHeader, StatCard, StatusBadge, Tabs } from "../components/ui";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { CardSkeleton } from "../components/Skeleton.jsx";
import CaminhaoDocumentos from "../components/CaminhaoDocumentos";
import RegistroDetailModal from "../components/RegistroDetailModal.jsx";
import NovoPneuModal from "../components/NovoPneuModal.jsx";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  PointElement,
  LineElement,
  Filler
);

const DETAIL_TABS = [
  { id: "resumo", label: "Resumo" },
  { id: "analise", label: "Análise" },
  { id: "registros", label: "Registros" },
  { id: "documentos", label: "Documentos" },
];

const CaminhaoDetail = () => {
  const { placa } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [registroModal, setRegistroModal] = useState(null);
  const [novoPneuOpen, setNovoPneuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("resumo");

  const { data, isLoading: loading, error } = useCaminhaoDetailQuery(placa);
  const {
    caminhoes,
    pneus: stockPneus,
    posicoes,
    statusOptions,
  } = usePneuAtribuirQueries();

  const caminhao = data?.caminhao ?? null;
  const gastos = useMemo(() => data?.gastos ?? [], [data?.gastos]);
  const checklists = useMemo(() => data?.checklists ?? [], [data?.checklists]);
  const pneus = useMemo(() => data?.pneus ?? [], [data?.pneus]);
  const consumoKmPorLitro = data?.consumoKmPorLitro ?? null;
  const listTruncation = data?.listTruncation ?? {
    gastos: false,
    checklists: false,
    gastosTotal: 0,
    checklistsTotal: 0,
  };

  const loadError = error?.message || null;

  const todosRegistros = useMemo(() => {
    const gastosFormatados = gastos.map((g) => ({
      ...g,
      tipo: "gasto",
      valor: parseFloat(g.valor),
      data: g.data_gasto,
      descricao: g.tipos_gastos?.nome_tipo,
    }));

    const manutencoesFormatadas = checklists.map((c) => ({
      ...c,
      tipo: "manutencao",
      valor: c.valor ? parseFloat(c.valor) : 0,
      data: c.data_manutencao,
      descricao: c.itens_checklist?.nome_item,
    }));

    return [...gastosFormatados, ...manutencoesFormatadas].sort(
      (a, b) => new Date(b.data) - new Date(a.data)
    );
  }, [gastos, checklists]);

  const gastosChartData = useMemo(() => {
    const monthlyData = {};
    todosRegistros.forEach((registro) => {
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
  }, [todosRegistros]);

  const gastosLineChartData = useMemo(() => {
    const sortedRegistros = [...todosRegistros]
      .filter((r) => r.valor > 0)
      .sort((a, b) => new Date(a.data) - new Date(b.data));

    const dates = sortedRegistros.map((r) =>
      new Date(r.data).toLocaleDateString("pt-BR")
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
  }, [todosRegistros]);

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
          callback: (value) => {
            return "R$ " + Number(value || 0).toLocaleString("pt-BR");
          },
        },
        grid: { color: "rgba(0, 0, 0, 0.05)" },
      },
      x: { grid: { display: false } },
    },
  };

  const estatisticas = useMemo(() => {
    const totalGastos = gastos.reduce(
      (sum, g) => sum + parseFloat(g.valor || 0),
      0
    );
    const totalManutencoesValor = checklists.reduce(
      (sum, c) => sum + parseFloat(c.valor || 0),
      0
    );
    const totalGeral = totalGastos + totalManutencoesValor;

    const gastosUltimoMes = todosRegistros
      .filter((r) => {
        const date = new Date(r.data);
        const umMesAtras = new Date();
        umMesAtras.setMonth(umMesAtras.getMonth() - 1);
        return date > umMesAtras && r.valor > 0;
      })
      .reduce((sum, r) => sum + r.valor, 0);

    return {
      totalGeral,
      totalGastos,
      totalManutencoesValor,
      gastosUltimoMes,
      totalManutencoes: checklists.length,
      totalPneus: pneus.length,
    };
  }, [gastos, checklists, pneus, todosRegistros]);

  if (loading) {
    return (
      <PageLayout wide={false} className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </PageLayout>
    );
  }

  if (loadError || !caminhao) {
    return (
      <PageLayout narrow className="space-y-4">
        <Alert
          type="error"
          title="Caminhão não encontrado"
          message={
            loadError ||
            `Não encontramos um caminhão com a placa "${placa}".`
          }
        />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Voltar
          </Button>
          <Button onClick={() => navigate("/")}>Ir para início</Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout wide={false} className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/" },
          { label: caminhao.placa },
        ]}
      />

      <PageHeader
        title={`Caminhão ${caminhao.placa}`}
        subtitle="Detalhes completos e análise de desempenho"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge
              status={caminhao.status || "Operacional"}
              type="vehicle"
            />
            <Button variant="outline" onClick={() => navigate("/")}>
              Voltar
            </Button>
            <Button
              onClick={() => navigate(`/caminhao/editar/${caminhao.placa}`)}
            >
              Editar veículo
            </Button>
          </div>
        }
      />

      <Tabs tabs={DETAIL_TABS} activeTab={activeTab} onChange={setActiveTab} />

        {(listTruncation.gastos || listTruncation.checklists) && (
          <Alert
            type="warning"
            className="mb-6"
            message={`Exibindo os ${API_CONFIG.LIST_MAX} registros mais recentes. Total no banco: ${
              listTruncation.gastos
                ? `${listTruncation.gastosTotal} gasto(s)`
                : ""
            }${
              listTruncation.gastos && listTruncation.checklists ? " e " : ""
            }${
              listTruncation.checklists
                ? `${listTruncation.checklistsTotal} manutenção(ões)`
                : ""
            }.`}
          />
        )}

        {activeTab === "resumo" && (
        <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            layout="compact"
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            value={estatisticas.totalGeral.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
            title="Total em Gastos"
            color="blue"
          />
          <StatCard
            layout="compact"
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            }
            value={estatisticas.gastosUltimoMes.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
            title="Gastos (30 dias)"
            color="green"
          />
          <StatCard
            layout="compact"
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            }
            value={estatisticas.totalManutencoes}
            title="Manutenções"
            color="purple"
          />
          <StatCard
            layout="compact"
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            value={estatisticas.totalPneus}
            title="Pneus"
            color="orange"
          />
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card title="Dados do Veículo" className="lg:col-span-2 h-full">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {[
                { label: "Placa", value: caminhao.placa },
                { label: "Motorista", value: caminhao.motorista || "N/A" },
                { label: "Marca", value: caminhao.marca || "N/A" },
                { label: "Modelo", value: caminhao.modelo || "N/A" },
                { label: "Ano", value: caminhao.ano || "N/A" },
                {
                  label: "KM Atual",
                  value: `${(caminhao.km_atual || 0).toLocaleString()} km`,
                },
                { label: "Qtd. Pneus", value: caminhao.qtd_pneus },
                { label: "Nº Cavalo", value: caminhao.numero_cavalo || "N/A" },
                {
                  label: "Carreta 1",
                  value: caminhao.placa_carreta_1 || "N/A",
                },
                {
                  label: "Carreta 2",
                  value: caminhao.placa_carreta_2 || "N/A",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <p className="text-sm text-gray-500 mb-1">{item.label}</p>
                  <p className="font-semibold text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Eficiência" className="h-full">
            <div className="flex flex-col items-center justify-center h-full py-4">
              {consumoKmPorLitro ? (
                <>
                  <div className="text-5xl font-bold text-green-600 mb-2">
                    {consumoKmPorLitro}
                  </div>
                  <p className="text-lg font-medium text-gray-600">Km/L</p>
                  <p className="text-sm text-gray-400 mt-4 text-center">
                    Média baseada nos últimos abastecimentos
                  </p>
                </>
              ) : (
                <div className="text-center text-gray-500">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p>Dados insuficientes para cálculo</p>
                </div>
              )}
            </div>
          </Card>
        </div>
        </div>
        )}

        {activeTab === "analise" && (
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
        )}

        {activeTab === "registros" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card
            title="Últimos Gastos"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/manutencao-gastos")}
              >
                Ver Todos
              </Button>
            }
          >
            <div className="space-y-4">
              {gastos.slice(0, 5).map((gasto) => (
                <button
                  key={gasto.id}
                  type="button"
                  onClick={() => setRegistroModal({ ...gasto, tipo: "gasto" })}
                  className="w-full flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100 text-left cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {gasto.tipos_gastos?.nome_tipo}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(gasto.data_gasto).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className="font-semibold text-gray-900">
                    R${" "}
                    {parseFloat(gasto.valor || 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </button>
              ))}
              {gastos.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Nenhum registro
                </p>
              )}
            </div>
          </Card>

          <Card
            title="Manutenções"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/manutencao-gastos")}
              >
                Ver Todos
              </Button>
            }
          >
            <div className="space-y-4">
              {checklists.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setRegistroModal({ ...item, tipo: "manutencao" })
                  }
                  className="w-full p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100 text-left cursor-pointer"
                >
                  <div className="flex justify-between mb-1">
                    <p className="font-medium text-gray-900">
                      {item.itens_checklist?.nome_item}
                    </p>
                    <span className="text-sm font-semibold text-gray-900">
                      R${" "}
                      {parseFloat(item.valor || 0).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(item.data_manutencao).toLocaleDateString("pt-BR")}
                  </p>
                </button>
              ))}
              {checklists.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Nenhum registro
                </p>
              )}
            </div>
          </Card>

          <Card
            title="Pneus"
            action={
              <div className="flex gap-2 flex-wrap justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setNovoPneuOpen(true)}
                >
                  + Novo pneu
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    navigate("/pneus/cadastro-em-lote", {
                      state: { caminhaoId: caminhao.id },
                    })
                  }
                  title="Cadastrar em Lote"
                >
                  + Lote
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/pneus")}
                >
                  Ver Todos
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              {pneus.slice(0, 5).map((pneu) => (
                <button
                  key={pneu.id}
                  type="button"
                  onClick={() => setRegistroModal({ ...pneu, tipo: "pneu" })}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100 text-left cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {pneu.posicoes_pneus?.nome_posicao}
                    </p>
                    <p className="text-xs text-gray-500">
                      {pneu.marca} {pneu.modelo}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      pneu.status_pneus?.nome_status === "em uso"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {pneu.status_pneus?.nome_status}
                  </span>
                </button>
              ))}
              {pneus.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Nenhum registro
                </p>
              )}
            </div>
          </Card>
        </div>
        )}

        {activeTab === "documentos" && (
          <Card title="Documentos do veículo (PDF)">
            <CaminhaoDocumentos placa={caminhao.placa} />
          </Card>
        )}

      <RegistroDetailModal
        registro={registroModal}
        onClose={() => setRegistroModal(null)}
      />

      <NovoPneuModal
        isOpen={novoPneuOpen}
        onClose={() => setNovoPneuOpen(false)}
        defaultCaminhaoId={caminhao?.id}
        caminhoes={caminhoes}
        posicoes={posicoes}
        statusOptions={statusOptions}
        stockPneus={stockPneus}
        onSuccess={() => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.caminhoes.detail(placa),
          });
          queryClient.invalidateQueries({ queryKey: ["pneus"] });
        }}
      />
    </PageLayout>
  );
};

export default CaminhaoDetail;
