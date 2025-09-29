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
import ConfirmModal from "../components/ConfirmModal"; // Importar o modal

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

const SuccessMessage = ({ message, onClose }) => (
  <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded-lg">
    <div className="flex justify-between items-center">
      <div className="flex items-center">
        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <span className="font-medium">{message}</span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-green-700 hover:text-green-900 ml-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
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
    orange: {
      bg: "bg-orange-100",
      text: "text-orange-800",
      border: "border-orange-500",
    },
    red: {
      bg: "bg-red-100",
      text: "text-red-800",
      border: "border-red-500",
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
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [stats, setStats] = useState({
    totalCaminhoes: 0,
    totalGastos: 0,
    totalManutencoes: 0,
    totalGastosManutencoes: 0,
    mediaGastos: 0,
  });
  const [filtro, setFiltro] = useState("placa");
  const [termoBusca, setTermoBusca] = useState("");
  
  // Estados para o modal de confirmação
  // Estados para modais
  const [modalOpen, setModalOpen] = useState(false);
  const [caminhaoParaExcluir, setCaminhaoParaExcluir] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [showCascadeModal, setShowCascadeModal] = useState(false);
  const [relatedRecordsInfo, setRelatedRecordsInfo] = useState("");

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
    tools: (
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
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  };

  // Busca todos os dados
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [caminhoesRes, gastosRes, checklistsRes] = await Promise.all([
        axios.get(`${API_URL}/api/caminhoes`),
        axios.get(`${API_URL}/api/gastos`),
        axios.get(`${API_URL}/api/checklist`),
      ]);

      setCaminhoes(caminhoesRes.data);
      setGastos(gastosRes.data);
      setChecklists(checklistsRes.data);

      // Calcular totais de gastos
      const totalGastosFinanceiros = gastosRes.data.reduce(
        (total, gasto) => total + parseFloat(gasto.valor || 0),
        0
      );

      const totalGastosManutencoes = checklistsRes.data.reduce(
        (total, checklist) => total + parseFloat(checklist.valor || 0),
        0
      );

      const totalGeral = totalGastosFinanceiros + totalGastosManutencoes;

      // Calcular média de gastos
      const totalRegistros = gastosRes.data.length + checklistsRes.data.length;
      const mediaGastos = totalRegistros > 0 ? totalGeral / totalRegistros : 0;

      setStats({
        totalCaminhoes: caminhoesRes.data.length,
        totalGastos: totalGeral,
        totalManutencoes: checklistsRes.data.length,
        totalGastosManutencoes: totalGastosManutencoes,
        mediaGastos: mediaGastos,
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
        case "motorista":
          return caminhao.motorista?.toLowerCase().includes(termo);
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
      setChecklists([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [caminhaoResponse, gastosResponse, checklistsResponse] = await Promise.all([
        axios.get(`${API_URL}/api/caminhoes/${placa.trim()}`),
        axios.get(`${API_URL}/api/gastos/caminhao/${placa.trim()}`),
        axios.get(`${API_URL}/api/checklist/caminhao/${placa.trim()}`),
      ]);

      setCaminhaoBuscado(caminhaoResponse.data);
      setGastos(gastosResponse.data);
      setChecklists(checklistsResponse.data);
    } catch (err) {
      setError("Caminhão não encontrado ou erro na busca.");
      console.error("Erro na busca:", err);
      setCaminhaoBuscado(null);
      setGastos([]);
      setChecklists([]);
    } finally {
      setLoading(false);
    }
  };

  // Função para abrir modal de confirmação de exclusão
  const handleOpenDeleteModal = (caminhao) => {
    setCaminhaoParaExcluir(caminhao);
    setModalOpen(true);
  };

  // Função para fechar modal
  const handleCloseModal = () => {
    setModalOpen(false);
    setCaminhaoParaExcluir(null);
  };

  // Função para excluir caminhão
  const handleDeleteCaminhao = async () => {
    if (!caminhaoParaExcluir) return;

    setExcluindo(true);
    try {
      await axios.delete(`${API_URL}/api/caminhoes/${caminhaoParaExcluir.placa}`);
      
      setSuccessMessage(`Caminhão ${caminhaoParaExcluir.placa} excluído com sucesso!`);
      
      // Atualizar a lista de caminhões
      setCaminhoes(prev => prev.filter(c => c.placa !== caminhaoParaExcluir.placa));
      
      // Fechar modal
      handleCloseModal();
      
      // Recarregar estatísticas
      fetchAllData();

    } catch (err) {
      console.error("Erro ao excluir caminhão:", err);
      
      // Verificar se é erro de registros relacionados
      if (err.response?.status === 409 && err.response?.data?.type === "RELATED_RECORDS_EXIST") {
        setRelatedRecordsInfo(err.response.data.error);
        setShowCascadeModal(true);
        setModalOpen(false); // Fechar o modal de confirmação simples
      } else {
        setError("Erro ao excluir caminhão. Tente novamente.");
      }
    } finally {
      setExcluindo(false);
    }
  };

  // Função para excluir caminhão com cascata (incluindo registros relacionados)
  const handleDeleteCaminhaoWithCascade = async () => {
    if (!caminhaoParaExcluir) return;

    setExcluindo(true);
    try {
      await axios.delete(`${API_URL}/api/caminhoes/${caminhaoParaExcluir.placa}/cascade`);
      
      setSuccessMessage(`Caminhão ${caminhaoParaExcluir.placa} e todos os registros relacionados foram excluídos com sucesso!`);
      
      // Atualizar a lista de caminhões
      setCaminhoes(prev => prev.filter(c => c.placa !== caminhaoParaExcluir.placa));
      
      // Fechar modais
      setShowCascadeModal(false);
      setCaminhaoParaExcluir(null);
      
      // Recarregar estatísticas
      fetchAllData();

    } catch (err) {
      console.error("Erro ao excluir caminhão com cascata:", err);
      setError("Erro ao excluir caminhão e registros relacionados. Tente novamente.");
    } finally {
      setExcluindo(false);
    }
  };

  const handleCloseCascadeModal = () => {
    setShowCascadeModal(false);
    setRelatedRecordsInfo("");
    setCaminhaoParaExcluir(null);
  };

  // Combinar gastos e manutenções para os gráficos
  const todosRegistros = useMemo(() => {
    const gastosFormatados = gastos.map(g => ({
      ...g,
      tipo: 'gasto',
      valor: parseFloat(g.valor || 0),
      data: g.data_gasto,
      descricao: g.tipos_gastos?.nome_tipo
    }));

    const manutencoesFormatadas = checklists.map(c => ({
      ...c,
      tipo: 'manutencao',
      valor: c.valor ? parseFloat(c.valor) : 0,
      data: c.data_manutencao,
      descricao: c.itens_checklist?.nome_item
    }));

    return [...gastosFormatados, ...manutencoesFormatadas].sort((a, b) => 
      new Date(b.data) - new Date(a.data)
    );
  }, [gastos, checklists]);

  // Dados dos gráficos memoizados - usando todos os registros
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
          backgroundColor: "rgba(0, 51, 102, 0.6)",
          borderColor: "rgba(0, 51, 102, 1)",
          borderWidth: 2,
          borderRadius: 6,
        },
      ],
    };
  }, [todosRegistros]);

  const gastosLineChartData = useMemo(() => {
    const sortedRegistros = [...todosRegistros]
      .filter(r => r.valor > 0)
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
  }, [todosRegistros]);

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

        {/* Success Message */}
        {successMessage && (
          <SuccessMessage 
            message={successMessage} 
            onClose={() => setSuccessMessage("")} 
          />
        )}

        {/* Conteúdo Principal */}
        {!loading && !error && (
          <>
            {/* Cards de Estatísticas */}
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
                    <option value="motorista">Motorista</option>
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
                        KM: {caminhaoBuscado.km_atual?.toLocaleString("pt-BR") || 0}
                      </span>
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        Pneus: {caminhaoBuscado.qtd_pneus}
                      </span>
                      {caminhaoBuscado.motorista && (
                        <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                          Motorista: {caminhaoBuscado.motorista}
                        </span>
                      )}
                      {caminhaoBuscado.numero_carreta && (
                        <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                          Carreta: {caminhaoBuscado.numero_carreta}
                        </span>
                      )}
                      {caminhaoBuscado.numero_cavalo && (
                        <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
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

                {/* Gráficos do caminhão buscado */}
                {todosRegistros.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="h-80">
                      <Bar options={chartOptions} data={gastosChartData} />
                    </div>
                    <div className="h-80">
                      <Line options={lineChartOptions} data={gastosLineChartData} />
                    </div>
                  </div>
                )}
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
                          "Motorista",
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
                          <td className="px-6 py-4">
                            {caminhao.motorista ? (
                              <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                {caminhao.motorista}
                              </span>
                            ) : (
                              <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                                Não definido
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {caminhao.km_atual?.toLocaleString("pt-BR") || 0}
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
                            <button
                              onClick={() => handleOpenDeleteModal(caminhao)}
                              className="text-red-600 hover:text-red-900 text-sm font-medium"
                            >
                              Excluir
                            </button>
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

        {/* Modal de Confirmação de Exclusão */}
        <ConfirmModal
          isOpen={modalOpen}
          onClose={handleCloseModal}
          onConfirm={handleDeleteCaminhao}
          title="Excluir Caminhão"
          message={`Tem certeza que deseja excluir o caminhão ${caminhaoParaExcluir?.placa}? Esta ação não pode ser desfeita.`}
          confirmText={excluindo ? "Excluindo..." : "Excluir"}
          cancelText="Cancelar"
        />

        {/* Modal de Confirmação de Exclusão com Cascata */}
        <ConfirmModal
          isOpen={showCascadeModal}
          onClose={handleCloseCascadeModal}
          onConfirm={handleDeleteCaminhaoWithCascade}
          title="Registros Relacionados Encontrados"
          message={
            <div>
              <p className="mb-3">{relatedRecordsInfo}</p>
              <p className="mb-3 font-medium text-orange-600">
                ⚠️ Você pode excluir o caminhão junto com TODOS os registros relacionados, 
                mas essa ação é <strong>irreversível</strong>.
              </p>
              <p className="text-sm text-gray-600">
                Deseja continuar com a exclusão completa?
              </p>
            </div>
          }
          confirmText={excluindo ? "Excluindo tudo..." : "Excluir Tudo"}
          cancelText="Cancelar"
          confirmButtonStyle="bg-red-600 hover:bg-red-700"
        />
      </div>
    </div>
  );
};

export default Home;