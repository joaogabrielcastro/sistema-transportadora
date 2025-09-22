// src/pages/CaminhaoDetail.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
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

// Registrando componentes do Chart.js
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

const API_URL = import.meta.env.VITE_API_URL;

// Componentes Reutilizáveis
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-20">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

const ErrorMessage = ({ message, onRetry }) => (
  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
    <div className="flex justify-between items-center">
      <p className="font-medium">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-4 bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 transition-colors"
        >
          Tentar Novamente
        </button>
      )}
    </div>
  </div>
);

const StatCard = ({ icon, value, label, color = "blue" }) => {
  const colorClasses = {
    blue: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      border: "border-blue-500",
    },
    green: {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-500",
    },
    purple: {
      bg: "bg-purple-100",
      text: "text-purple-800",
      border: "border-purple-500",
    },
    orange: {
      bg: "bg-orange-100",
      text: "text-orange-800",
      border: "border-orange-500",
    },
  };

  const currentColor = colorClasses[color];

  return (
    <div
      className={`bg-white rounded-xl shadow-md p-6 border-l-4 ${currentColor.border}`}
    >
      <div className="flex items-center">
        <div className={`rounded-full ${currentColor.bg} p-3 mr-4`}>{icon}</div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{value}</h2>
          <p className="text-gray-600">{label}</p>
        </div>
      </div>
    </div>
  );
};

const InfoSection = ({ title, children, action }) => (
  <div className="bg-white rounded-xl shadow-md p-6">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
      {action}
    </div>
    {children}
  </div>
);

const CaminhaoDetail = () => {
  const { placa } = useParams();
  const [caminhao, setCaminhao] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [pneus, setPneus] = useState([]);
  const [consumoKmPorLitro, setConsumoKmPorLitro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const caminhaoRes = await axios.get(`${API_URL}/api/caminhoes/${placa}`);
      const caminhaoData = caminhaoRes.data;
      setCaminhao(caminhaoData);

      if (caminhaoData) {
        const [gastosRes, checklistRes, pneusRes, consumoRes] =
          await Promise.all([
            axios.get(`${API_URL}/api/gastos/caminhao/${caminhaoData.id}`),
            axios.get(`${API_URL}/api/checklist/caminhao/${caminhaoData.id}`),
            axios.get(`${API_URL}/api/pneus/caminhao/${caminhaoData.id}`),
            axios.get(`${API_URL}/api/gastos/consumo/${caminhaoData.id}`),
          ]);

        setGastos(gastosRes.data);
        setChecklists(checklistRes.data);
        setPneus(pneusRes.data);

        // Cálculo do consumo
        const abastecimentos = consumoRes.data;
        if (abastecimentos && abastecimentos.length > 1) {
          const ultimoAbastecimento = abastecimentos[0];
          const penultimoAbastecimento = abastecimentos[1];

          const kmRodado =
            ultimoAbastecimento.km_registro -
            penultimoAbastecimento.km_registro;
          const litrosAbastecidos = parseFloat(
            ultimoAbastecimento.quantidade_combustivel
          );

          if (litrosAbastecidos > 0 && kmRodado > 0) {
            const kmL = (kmRodado / litrosAbastecidos).toFixed(2);
            setConsumoKmPorLitro(kmL);
          }
        }
      }
    } catch (err) {
      setError(
        "Erro ao carregar dados do caminhão. Verifique a conexão com o servidor."
      );
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [placa]);

  // Dados para gráficos
  const gastosChartData = useMemo(() => {
    const monthlyData = {};
    gastos.forEach((gasto) => {
      const date = new Date(gasto.data_gasto);
      const month = date.toLocaleString("pt-BR", {
        month: "short",
        year: "numeric",
      });
      monthlyData[month] = (monthlyData[month] || 0) + parseFloat(gasto.valor);
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
  }, [gastos]);

  const gastosLineChartData = useMemo(() => {
    const sortedGastos = [...gastos].sort(
      (a, b) => new Date(a.data_gasto) - new Date(b.data_gasto)
    );

    const dates = sortedGastos.map((g) => {
      const date = new Date(g.data_gasto);
      return date.toLocaleDateString("pt-BR");
    });

    const cumulativeData = [];
    let cumulativeTotal = 0;

    sortedGastos.forEach((gasto) => {
      cumulativeTotal += parseFloat(gasto.valor);
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
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    };
  }, [gastos]);

  const gastosPorTipoData = useMemo(() => {
    const tipoData = {};
    gastos.forEach((gasto) => {
      const tipo = gasto.tipos_gastos?.nome_tipo || "Outros";
      tipoData[tipo] = (tipoData[tipo] || 0) + parseFloat(gasto.valor);
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
          backgroundColor: cores,
          borderColor: cores.map((color) => color.replace("0.8", "1")),
          borderWidth: 2,
        },
      ],
    };
  }, [gastos]);

  // Opções dos gráficos
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      title: {
        display: true,
        text: "Gastos Mensais",
        font: { size: 16, weight: "bold" },
        padding: { top: 10, bottom: 20 },
      },
      tooltip: {
        callbacks: {
          label: (context) =>
            `R$ ${context.raw.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => "R$ " + value.toLocaleString("pt-BR"),
        },
      },
    },
  };

  const lineChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        ...chartOptions.plugins.title,
        text: "Evolução de Gastos",
      },
    },
  };

  const doughnutOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      title: {
        ...chartOptions.plugins.title,
        text: "Gastos por Tipo",
      },
    },
  };

  // Estatísticas calculadas
  const estatisticas = useMemo(() => {
    const totalGastos = gastos.reduce(
      (sum, gasto) => sum + parseFloat(gasto.valor),
      0
    );
    const gastosUltimoMes = gastos
      .filter((gasto) => {
        const gastoDate = new Date(gasto.data_gasto);
        const umMesAtras = new Date();
        umMesAtras.setMonth(umMesAtras.getMonth() - 1);
        return gastoDate > umMesAtras;
      })
      .reduce((sum, gasto) => sum + parseFloat(gasto.valor), 0);

    return {
      totalGastos,
      gastosUltimoMes,
      totalManutencoes: checklists.length,
      totalPneus: pneus.length,
    };
  }, [gastos, checklists, pneus]);

  // Ícones
  const icons = {
    money: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
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
    ),
    chart: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
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
    ),
    truck: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    tire: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
    ),
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;
  if (!caminhao)
    return (
      <div className="text-center mt-10 text-gray-600">
        Caminhão não encontrado.
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Caminhão {caminhao.placa}
            </h1>
            <p className="text-gray-600 text-lg">
              Detalhes completos e análise de desempenho
            </p>
          </div>
          <Link
            to="/"
            className="flex items-center text-blue-600 hover:text-blue-800 mt-4 lg:mt-0"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Voltar para a frota
          </Link>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={icons.money}
            value={estatisticas.totalGastos.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
            label="Total em Gastos"
            color="blue"
          />
          <StatCard
            icon={icons.chart}
            value={estatisticas.gastosUltimoMes.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
            label="Gastos Último Mês"
            color="green"
          />
          <StatCard
            icon={icons.truck}
            value={estatisticas.totalManutencoes}
            label="Manutenções Realizadas"
            color="purple"
          />
          <StatCard
            icon={icons.tire}
            value={estatisticas.totalPneus}
            label="Pneus Cadastrados"
            color="orange"
          />
        </div>

        {/* Indicador de Consumo */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Eficiência do Veículo
          </h2>
          {consumoKmPorLitro !== null ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-green-600">
                  {consumoKmPorLitro} Km/L
                </p>
                <p className="text-gray-600">Consumo médio de combustível</p>
              </div>
              <div className="text-4xl">⛽</div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500">
                Dados insuficientes para calcular o consumo médio.
              </p>
              <p className="text-sm text-gray-400 mt-1">
                São necessários pelo menos 2 abastecimentos com registro de KM.
              </p>
            </div>
          )}
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="h-80">
              <Bar options={chartOptions} data={gastosChartData} />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="h-80">
              <Line options={lineChartOptions} data={gastosLineChartData} />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 lg:col-span-2">
            <div className="h-80">
              <Doughnut options={doughnutOptions} data={gastosPorTipoData} />
            </div>
          </div>
        </div>

        {/* Listas de Dados */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Gastos Recentes */}
          <InfoSection
            title="Gastos Recentes"
            action={
              <Link
                to="/manutencao-gastos"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Ver Todos
              </Link>
            }
          >
            {gastos.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">💰</div>
                <p>Nenhum gasto registrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {gastos.slice(0, 5).map((gasto) => (
                  <div
                    key={gasto.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {gasto.tipos_gastos?.nome_tipo}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(gasto.data_gasto).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        R${" "}
                        {parseFloat(gasto.valor).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                      <Link
                        to={`/gasto/editar/${gasto.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Editar
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </InfoSection>

          {/* Manutenções */}
          <InfoSection
            title="Manutenções Recentes"
            action={
              <Link
                to="/manutencao-gastos"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Ver Todos
              </Link>
            }
          >
            {checklists.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🔧</div>
                <p>Nenhuma manutenção registrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {checklists.slice(0, 5).map((checklist) => (
                  <div key={checklist.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900">
                      {checklist.itens_checklist?.nome_item}
                    </p>
                    <p className="text-sm text-gray-500 mb-1">
                      {new Date(checklist.data_manutencao).toLocaleDateString(
                        "pt-BR"
                      )}
                    </p>
                    {checklist.observacao && (
                      <p className="text-sm text-gray-600 truncate">
                        {checklist.observacao}
                      </p>
                    )}
                    <Link
                      to={`/checklist/editar/${checklist.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm block mt-2"
                    >
                      Editar
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </InfoSection>

          {/* Pneus */}
          <InfoSection
            title="Pneus do Veículo"
            action={
              <Link
                to="/pneus"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Ver Todos
              </Link>
            }
          >
            {pneus.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🚗</div>
                <p>Nenhum pneu cadastrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pneus.map((pneu) => (
                  <div key={pneu.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-900">
                        {pneu.posicoes_pneus?.nome_posicao}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          pneu.status_pneus?.nome_status === "em uso"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {pneu.status_pneus?.nome_status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {pneu.marca} {pneu.modelo}
                    </p>
                    <p className="text-sm text-gray-500">
                      Instalado em:{" "}
                      {new Date(pneu.data_instalacao).toLocaleDateString(
                        "pt-BR"
                      )}
                    </p>
                    <Link
                      to={`/pneu/editar/${pneu.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm block mt-2"
                    >
                      Editar
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </InfoSection>
        </div>
      </div>
    </div>
  );
};

export default CaminhaoDetail;
