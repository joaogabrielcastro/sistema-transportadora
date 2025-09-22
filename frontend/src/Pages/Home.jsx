// src/pages/Home.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
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
import { Bar, Line } from "react-chartjs-2";

// Configuração do ChartJS
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

// Componentes de Loading e Error
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-blue"></div>
  </div>
);

const ErrorMessage = ({ message, onRetry }) => (
  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg">
    <div className="flex justify-between items-center">
      <p>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-4 bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors"
        >
          Tentar Novamente
        </button>
      )}
    </div>
  </div>
);

const EmptyState = ({ icon, title, description }) => (
  <div className="bg-white rounded-xl shadow-md p-8 text-center">
    <div className="text-4xl mb-3">{icon}</div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

// Componente de Card de Estatística
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

const Home = () => {
  const [placa, setPlaca] = useState("");
  const [caminhoes, setCaminhoes] = useState([]);
  const [caminhaoBuscado, setCaminhaoBuscado] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalCaminhoes: 0,
    totalGastos: 0,
    mediaGastos: 0,
  });
  const [filtro, setFiltro] = useState("placa");
  const [termoBusca, setTermoBusca] = useState("");

  // Ícones reutilizáveis
  const icons = {
    truck: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6 text-navy-blue"
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
    money: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-6 w-6 text-navy-blue"
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
        className="h-6 w-6 text-navy-blue"
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
  };

  // Busca todos os dados
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [caminhoesRes, gastosRes] = await Promise.all([
        axios.get(`${API_URL}/api/caminhoes`),
        axios.get(`${API_URL}/api/gastos`),
      ]);

      setCaminhoes(caminhoesRes.data);

      const totalGastos = gastosRes.data.reduce(
        (total, gasto) => total + parseFloat(gasto.valor),
        0
      );
      const mediaGastos =
        gastosRes.data.length > 0 ? totalGastos / gastosRes.data.length : 0;

      setStats({
        totalCaminhoes: caminhoesRes.data.length,
        totalGastos,
        mediaGastos,
      });
    } catch (err) {
      setError("Erro ao carregar dados iniciais.");
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Filtro memoizado
  const caminhoesFiltrados = useMemo(() => {
    if (!termoBusca.trim()) return caminhoes;

    const termo = termoBusca.toLowerCase().trim();

    return caminhoes.filter((caminhao) => {
      switch (filtro) {
        case "placa":
          return caminhao.placa?.toLowerCase().includes(termo);
        case "carreta":
          return String(caminhao.numero_carreta || "")
            .toLowerCase()
            .includes(termo);
        case "cavalo":
          return String(caminhao.numero_cavalo || "")
            .toLowerCase()
            .includes(termo);
        default:
          return true;
      }
    });
  }, [termoBusca, filtro, caminhoes]);

  // Busca individual
  const handleSearch = async (e) => {
    e.preventDefault();

    if (!placa.trim()) {
      setCaminhaoBuscado(null);
      setGastos([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [caminhaoResponse, gastosResponse] = await Promise.all([
        axios.get(`${API_URL}/api/caminhoes/${placa.trim()}`),
        axios.get(`${API_URL}/api/gastos/caminhao/${placa.trim()}`),
      ]);

      setCaminhaoBuscado(caminhaoResponse.data);
      setGastos(gastosResponse.data);
    } catch (err) {
      setError("Caminhão não encontrado ou erro na busca.");
      console.error("Erro na busca:", err);
      setCaminhaoBuscado(null);
      setGastos([]);
    } finally {
      setLoading(false);
    }
  };

  // Dados dos gráficos memoizados
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
          backgroundColor: "rgba(0, 51, 102, 0.6)",
          borderColor: "rgba(0, 51, 102, 1)",
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

    const dates = sortedGastos.map((g) =>
      new Date(g.data_gasto).toLocaleDateString("pt-BR")
    );

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
          backgroundColor: "rgba(0, 51, 102, 0.1)",
          borderColor: "rgba(0, 51, 102, 1)",
          borderWidth: 2,
          tension: 0.3,
          pointBackgroundColor: "rgba(0, 51, 102, 1)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
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
        text: "Resumo de Gastos Mensais",
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-navy-blue mb-2">
            Broto Transportadora
          </h1>
          <p className="text-gray-600 text-lg md:text-xl">
            Sistema de gestão de frotas e manutenção
          </p>
        </div>

        {/* Loading State */}
        {loading && <LoadingSpinner />}

        {/* Error State */}
        {error && <ErrorMessage message={error} onRetry={fetchAllData} />}

        {/* Conteúdo Principal */}
        {!loading && !error && (
          <>
            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                icon={icons.chart}
                value={`R$ ${stats.mediaGastos.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}`}
                label="Média por gasto"
                color="purple"
              />
            </div>

            {/* Filtro de Caminhões */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
              <h2 className="text-xl font-bold text-navy-blue mb-4">
                Filtrar Frota
              </h2>
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
                <div className="w-full md:w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filtrar por
                  </label>
                  <select
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-blue focus:border-navy-blue transition-colors"
                  >
                    <option value="placa">Placa</option>
                    <option value="carreta">Nº Carreta</option>
                    <option value="cavalo">Nº Cavalo</option>
                  </select>
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Termo de busca
                  </label>
                  <input
                    type="text"
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    placeholder={`Digite o ${filtro} para buscar...`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-blue focus:border-navy-blue transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Resultado da Busca Individual */}
            {caminhaoBuscado && (
              <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-navy-blue">
                      Caminhão - {caminhaoBuscado.placa}
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                        KM: {caminhaoBuscado.km_atual.toLocaleString("pt-BR")}
                      </span>
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        Pneus: {caminhaoBuscado.qtd_pneus}
                      </span>
                      {caminhaoBuscado.numero_carreta && (
                        <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                          Carreta: {caminhaoBuscado.numero_carreta}
                        </span>
                      )}
                      {caminhaoBuscado.numero_cavalo && (
                        <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                          Cavalo: {caminhaoBuscado.numero_cavalo}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 md:mt-0">
                    <Link
                      to={`/caminhao/editar/${caminhaoBuscado.placa}`}
                      className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors flex items-center"
                    >
                      ✏️ Editar
                    </Link>
                    <Link
                      to={`/caminhao/${caminhaoBuscado.placa}`}
                      className="px-4 py-2 bg-navy-blue text-white rounded-lg hover:bg-blue-800 transition-colors flex items-center"
                    >
                      🔍 Detalhes
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de Caminhões */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-navy-blue">
                    Frota de Caminhões
                  </h2>
                  <p className="text-gray-600">
                    {caminhoesFiltrados.length} de {caminhoes.length} caminhões
                  </p>
                </div>
                <Link
                  to="/cadastro-caminhao"
                  className="px-4 py-2 bg-navy-blue text-white rounded-lg hover:bg-blue-800 transition-colors flex items-center"
                >
                  ➕ Novo Caminhão
                </Link>
              </div>

              {caminhoesFiltrados.length > 0 ? (
                <div className="overflow-x-auto rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {[
                          "Placa",
                          "KM Atual",
                          "Qtd. Pneus",
                          "Carreta",
                          "Cavalo",
                          "Ações",
                        ].map((header) => (
                          <th
                            key={header}
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {caminhoesFiltrados.map((caminhao) => (
                        <tr
                          key={caminhao.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {caminhao.placa}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {caminhao.km_atual.toLocaleString("pt-BR")}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              {caminhao.qtd_pneus}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                              {caminhao.numero_carreta || "-"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                              {caminhao.numero_cavalo || "-"}
                            </span>
                          </td>
                          <td className="px-6 py-4 space-x-2">
                            <Link
                              to={`/caminhao/editar/${caminhao.placa}`}
                              className="text-yellow-600 hover:text-yellow-900 text-sm font-medium"
                            >
                              Editar
                            </Link>
                            <Link
                              to={`/caminhao/${caminhao.placa}`}
                              className="text-navy-blue hover:text-blue-800 text-sm font-medium"
                            >
                              Detalhes
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon="🚛"
                  title="Nenhum caminhão encontrado"
                  description={
                    termoBusca
                      ? `Não foram encontrados caminhões com ${filtro} contendo "${termoBusca}"`
                      : "Nenhum caminhão cadastrado na frota."
                  }
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Home;
