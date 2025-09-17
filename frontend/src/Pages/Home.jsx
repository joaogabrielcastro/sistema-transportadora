// src/pages/Home.jsx
import React, { useState, useEffect } from "react";
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
  Filler
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

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
    mediaGastos: 0
  });

  // Busca todos os caminhões e estatísticas ao carregar a página
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [caminhoesRes, gastosRes] = await Promise.all([
          axios.get(`${API_URL}/api/caminhoes`),
          axios.get(`${API_URL}/api/gastos`)
        ]);
        
        setCaminhoes(caminhoesRes.data);
        
        // Calcular estatísticas
        const totalGastos = gastosRes.data.reduce((total, gasto) => total + parseFloat(gasto.valor), 0);
        const mediaGastos = gastosRes.data.length > 0 ? totalGastos / gastosRes.data.length : 0;
        
        setStats({
          totalCaminhoes: caminhoesRes.data.length,
          totalGastos,
          mediaGastos
        });
      } catch (err) {
        setError("Erro ao carregar dados iniciais.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setGastos([]);

    if (placa === "") {
      setCaminhaoBuscado(null);
      setLoading(false);
      return;
    }

    try {
      const caminhaoResponse = await axios.get(
        `${API_URL}/api/caminhoes/${placa}`
      );
      setCaminhaoBuscado(caminhaoResponse.data);

      const gastosResponse = await axios.get(
        `${API_URL}/api/gastos/caminhao/${caminhaoResponse.data.id}`
      );
      setGastos(gastosResponse.data);
    } catch (err) {
      setError("Caminhão não encontrado ou erro na busca.");
      console.error(err);
      setCaminhaoBuscado(null);
    } finally {
      setLoading(false);
    }
  };

  const getGastosDataForChart = () => {
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
  };

  const getGastosLineChartData = () => {
    // Ordenar gastos por data
    const sortedGastos = [...gastos].sort((a, b) => 
      new Date(a.data_gasto) - new Date(b.data_gasto)
    );
    
    const dates = sortedGastos.map(g => {
      const date = new Date(g.data_gasto);
      return date.toLocaleDateString('pt-BR');
    });
    
    const cumulativeData = [];
    let cumulativeTotal = 0;
    
    sortedGastos.forEach(gasto => {
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
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { 
        position: "top",
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      title: { 
        display: true, 
        text: "Resumo de Gastos Mensais",
        font: { size: 16, weight: 'bold' },
        padding: { top: 10, bottom: 20 }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return 'R$ ' + value.toLocaleString('pt-BR');
          }
        }
      }
    }
  };

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: { 
        position: "top",
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      title: { 
        display: true, 
        text: "Evolução de Gastos",
        font: { size: 16, weight: 'bold' },
        padding: { top: 10, bottom: 20 }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return 'R$ ' + value.toLocaleString('pt-BR');
          }
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Broto Transportadora
          </h1>
          <p className="text-gray-600 text-lg">
            Sistema de gestão de frotas e manutenção
          </p>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center">
              <div className="rounded-full bg-blue-100 p-3 mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{stats.totalCaminhoes}</h2>
                <p className="text-gray-600">Caminhões na frota</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center">
              <div className="rounded-full bg-green-100 p-3 mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  R$ {stats.totalGastos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h2>
                <p className="text-gray-600">Total em gastos</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center">
              <div className="rounded-full bg-purple-100 p-3 mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  R$ {stats.mediaGastos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h2>
                <p className="text-gray-600">Média por gasto</p>
              </div>
            </div>
          </div>
        </div>

        {/* Busca de Caminhão */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Buscar Caminhão</h2>
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Placa do Caminhão</label>
              <input
                type="text"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                placeholder="Digite a placa (ex: ABC1D23) ou deixe em branco para ver todos"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <button 
              type="submit" 
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center min-w-[120px]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Buscando...
                </>
              ) : "Buscar"}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg">
            <p>{error}</p>
          </div>
        )}

        {/* Resultado da Busca Individual */}
        {!loading && !error && caminhaoBuscado && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Caminhão - {caminhaoBuscado.placa}
                </h2>
                <div className="flex flex-wrap gap-4 mt-2">
                  <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    KM: {caminhaoBuscado.km_atual}
                  </div>
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    Pneus: {caminhaoBuscado.qtd_pneus}
                  </div>
                  {/* Adicionar informações de carreta e cavalo */}
                  {caminhaoBuscado.numero_carreta && (
                    <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                      Carreta: {caminhaoBuscado.numero_carreta}
                    </div>
                  )}
                  {caminhaoBuscado.numero_cavalo && (
                    <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                      Cavalo: {caminhaoBuscado.numero_cavalo}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex space-x-2 mt-4 md:mt-0">
                <Link
                  to={`/caminhao/editar/${caminhaoBuscado.placa}`}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Editar
                </Link>
                <Link
                  to={`/caminhao/${caminhaoBuscado.placa}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Detalhes
                </Link>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-800 mb-4">Análise de Gastos</h3>
            
            {gastos.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-80">
                  <Bar options={chartOptions} data={getGastosDataForChart()} />
                </div>
                <div className="h-80">
                  <Line options={lineChartOptions} data={getGastosLineChartData()} />
                </div>
              </div>
            ) : (
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-600">Nenhum gasto encontrado para este caminhão.</p>
              </div>
            )}
          </div>
        )}

        {/* Lista de Todos os Caminhões */}
        {!loading && !error && placa === "" && caminhoes.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Frota de Caminhões</h2>
              <Link 
                to="/cadastro-caminhao" 
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Novo Caminhão
              </Link>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placa</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KM Atual</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qtd. Pneus</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Carreta</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cavalo</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {caminhoes.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{c.placa}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-600">{c.km_atual}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {c.qtd_pneus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                          {c.numero_carreta || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
                          {c.numero_cavalo || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          to={`/caminhao/editar/${c.placa}`}
                          className="text-yellow-600 hover:text-yellow-900 mr-3"
                        >
                          Editar
                        </Link>
                        <Link
                          to={`/caminhao/${c.placa}`}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Detalhes
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;