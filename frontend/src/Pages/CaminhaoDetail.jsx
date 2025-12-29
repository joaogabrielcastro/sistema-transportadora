import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { Card, Button, Alert, LoadingSpinner } from "../components/ui";
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

const StatCard = ({ icon, value, label, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    orange: "bg-orange-50 text-orange-600 border-orange-200",
  };

  return (
    <div
      className={`p-6 rounded-xl border ${colorClasses[color]} transition-all duration-200 hover:shadow-md`}
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg bg-white shadow-sm`}>{icon}</div>
        <div>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          <p className="text-sm font-medium opacity-80">{label}</p>
        </div>
      </div>
    </div>
  );
};

const CaminhaoDetail = () => {
  const { placa } = useParams();
  const navigate = useNavigate();
  const { get } = useApi();

  const [caminhao, setCaminhao] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [pneus, setPneus] = useState([]);
  const [consumoKmPorLitro, setConsumoKmPorLitro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const caminhaoRes = await get(`/caminhoes/${placa}`);
      const caminhaoData = caminhaoRes?.data || caminhaoRes;
      setCaminhao(caminhaoData);

      if (caminhaoData && caminhaoData.id) {
        const [gastosRes, checklistRes, pneusRes, consumoRes] =
          await Promise.all([
            get(`/gastos/caminhao/${caminhaoData.id}`),
            get(`/checklist/caminhao/${caminhaoData.id}`),
            get(`/pneus/caminhao/${caminhaoData.id}`),
            get(`/gastos/consumo/${caminhaoData.id}`),
          ]);

        const extractArray = (res) => {
          if (Array.isArray(res)) return res;
          if (res?.data && Array.isArray(res.data)) return res.data;
          if (res?.data?.data && Array.isArray(res.data.data))
            return res.data.data;
          return [];
        };

        const gastosData = extractArray(gastosRes);
        const checklistData = extractArray(checklistRes);
        const pneusData = extractArray(pneusRes);
        const consumoData = extractArray(consumoRes);

        setGastos(gastosData);
        setChecklists(checklistData);
        setPneus(pneusData);

        if (consumoData && consumoData.length > 1) {
          const ultimo = consumoData[0];
          const penultimo = consumoData[1];
          const kmRodado = ultimo.km_registro - penultimo.km_registro;
          const litros = parseFloat(ultimo.quantidade_combustivel);

          if (litros > 0 && kmRodado > 0) {
            setConsumoKmPorLitro((kmRodado / litros).toFixed(2));
          }
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      setError("Erro ao carregar dados do caminhão.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [placa]);

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

  if (loading) return <LoadingSpinner fullScreen />;

  if (error) {
    return (
      <div className="min-h-screen bg-background pt-24 px-4 flex justify-center">
        <div className="w-full max-w-2xl">
          <Alert type="error" message={error} />
          <Button className="mt-4" onClick={fetchData}>
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!caminhao) return null;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-7xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
              Caminhão {caminhao.placa}
              <span className="text-sm font-normal px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                {caminhao.status || "Ativo"}
              </span>
            </h1>
            <p className="text-text-secondary mt-1">
              Detalhes completos e análise de desempenho
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/")}>
              Voltar
            </Button>
            <Button
              onClick={() => navigate(`/caminhao/editar/${caminhao.placa}`)}
            >
              Editar Veículo
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
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
            label="Total em Gastos"
            color="blue"
          />
          <StatCard
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
            label="Gastos (30 dias)"
            color="green"
          />
          <StatCard
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
            label="Manutenções"
            color="purple"
          />
          <StatCard
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
            label="Pneus"
            color="orange"
          />
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
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
        </div>

        {/* Lists */}
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
                <div
                  key={gasto.id}
                  className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100"
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
                </div>
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
                <div
                  key={item.id}
                  className="p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100"
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
                </div>
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
              <div className="flex gap-2">
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
                <div
                  key={pneu.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100"
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
                </div>
              ))}
              {pneus.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Nenhum registro
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CaminhaoDetail;
