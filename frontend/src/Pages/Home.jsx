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
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

const Home = () => {
  const [placa, setPlaca] = useState("");
  const [caminhoes, setCaminhoes] = useState([]);
  const [caminhaoBuscado, setCaminhaoBuscado] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Busca todos os caminhões ao carregar a página
  useEffect(() => {
    const fetchAllCaminhoes = async () => {
      setLoading(true);
      try {
        const response = await axios.get("http://localhost:3000/api/caminhoes");
        setCaminhoes(response.data);
      } catch (err) {
        setError("Erro ao carregar a lista de caminhões.");
      } finally {
        setLoading(false);
      }
    };
    fetchAllCaminhoes();
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
        `http://localhost:3000/api/caminhoes/${placa}`
      );
      setCaminhaoBuscado(caminhaoResponse.data);

      const gastosResponse = await axios.get(
        `http://localhost:3000/api/gastos/caminhao/${caminhaoResponse.data.id}`
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
        month: "long",
        year: "numeric",
      });
      monthlyData[month] = (monthlyData[month] || 0) + parseFloat(gasto.valor);
    });

    return {
      labels: Object.keys(monthlyData),
      datasets: [
        {
          label: "Gastos Mensais",
          data: Object.values(monthlyData),
          backgroundColor: "rgba(255, 99, 132, 0.6)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "Resumo de Gastos Mensais" },
    },
  };

  return (
    <div className="flex flex-col items-center p-8 bg-neutral min-h-screen">
      <div className="card w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-text-dark">
          Broto Transportadora
        </h1>

        {/* O bloco <nav> foi removido daqui */}

        <form
          onSubmit={handleSearch}
          className="flex flex-col md:flex-row gap-4 mb-8"
        >
          <input
            type="text"
            value={placa}
            onChange={(e) => setPlaca(e.target.value)}
            placeholder="Digite a placa do caminhão (ou deixe em branco para ver todos)"
            className="input flex-1"
          />
          <button type="submit" className="btn-primary">
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </form>

        {error && (
          <div className="bg-accent text-white p-4 mb-4 rounded text-center">
            {error}
          </div>
        )}

        {loading && <div className="text-center">Carregando...</div>}

        {!loading && !error && placa !== "" && !caminhaoBuscado && (
          <div className="bg-white p-6 rounded-lg mt-6 text-center">
            <p>Nenhum caminhão encontrado para a placa "{placa}".</p>
          </div>
        )}

        {/* Exibe o resultado da busca individual */}
        {!loading && !error && caminhaoBuscado && (
          <div className="card w-full mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Dados do Caminhão - Placa: {caminhaoBuscado.placa}
              </h2>
              <div className="flex space-x-2">
                <Link
                  to={`/caminhao/editar/${caminhaoBuscado.placa}`}
                  className="btn-primary"
                >
                  Editar
                </Link>
                <Link
                  to={`/caminhao/${caminhaoBuscado.placa}`}
                  className="btn-secondary"
                >
                  Ver Detalhes
                </Link>
              </div>
            </div>

            <p className="text-text-dark">
              KM Atual: {caminhaoBuscado.km_atual}
            </p>
            <p className="text-text-dark">
              Quantidade de Pneus: {caminhaoBuscado.qtd_pneus}
            </p>

            <h3 className="text-lg font-bold mt-6 mb-4">Resumo de Gastos</h3>
            {gastos.length > 0 ? (
              <div className="w-full h-80">
                <Bar options={chartOptions} data={getGastosDataForChart()} />
              </div>
            ) : (
              <p className="text-gray-500">
                Nenhum gasto encontrado para este caminhão.
              </p>
            )}
          </div>
        )}

        {/* Exibe a lista de todos os caminhões se a busca for vazia */}
        {!loading && !error && placa === "" && caminhoes.length > 0 && (
          <div className="card w-full mt-6">
            <h2 className="text-xl font-bold mb-4">
              Todos os Caminhões Cadastrados
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr className="bg-neutral">
                    <th className="py-2 px-4 border-b">Placa</th>
                    <th className="py-2 px-4 border-b">KM Atual</th>
                    <th className="py-2 px-4 border-b">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {caminhoes.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 px-4 border-b text-center">
                        {c.placa}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        {c.km_atual}
                      </td>
                      <td className="py-2 px-4 border-b text-center">
                        <Link
                          to={`/caminhao/editar/${c.placa}`}
                          className="btn-primary text-sm px-2 py-1 mr-2"
                        >
                          Editar
                        </Link>
                        <Link
                          to={`/caminhao/${c.placa}`}
                          className="btn-secondary text-sm px-2 py-1"
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
