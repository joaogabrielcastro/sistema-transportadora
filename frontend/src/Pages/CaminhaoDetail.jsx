// src/pages/CaminhaoDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const CaminhaoDetail = () => {
  const { placa } = useParams();
  const [caminhao, setCaminhao] = useState(null);
  const [gastos, setGastos] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [pneus, setPneus] = useState([]);
  const [consumoKmPorLitro, setConsumoKmPorLitro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const caminhaoRes = await axios.get(`${API_URL}/api/caminhoes/${placa}`);
        const caminhaoData = caminhaoRes.data;
        setCaminhao(caminhaoData);

        if (caminhaoData) {
          const [gastosRes, checklistRes, pneusRes, consumoRes] = await Promise.all([
            axios.get(`${API_URL}/api/gastos/caminhao/${caminhaoData.id}`),
            axios.get(`${API_URL}/api/checklist/caminhao/${caminhaoData.id}`),
            axios.get(`${API_URL}/api/pneus/caminhao/${caminhaoData.id}`),
            axios.get(`${API_URL}/api/gastos/consumo/${caminhaoData.id}`),
          ]);

          setGastos(gastosRes.data);
          setChecklists(checklistRes.data);
          setPneus(pneusRes.data);
          
          const abastecimentos = consumoRes.data;
          if (abastecimentos && abastecimentos.length > 1) {
            const ultimoAbastecimento = abastecimentos[0];
            const penultimoAbastecimento = abastecimentos[1];
            
            const kmRodado = ultimoAbastecimento.km_registro - penultimoAbastecimento.km_registro;
            const litrosAbastecidos = parseFloat(ultimoAbastecimento.quantidade_combustivel);

            if (litrosAbastecidos > 0 && kmRodado > 0) {
              const kmL = (kmRodado / litrosAbastecidos).toFixed(2);
              setConsumoKmPorLitro(kmL);
            }
          }
        }
      } catch (err) {
        setError('Erro ao carregar dados do caminhão. Verifique a conexão com o backend.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [placa]);

  if (loading) return <div className="text-center mt-10">Carregando...</div>;
  if (error) return <div className="text-center mt-10 text-accent">{error}</div>;
  if (!caminhao) return <div className="text-center mt-10 text-text-dark">Caminhão não encontrado.</div>;

  return (
    <div className="p-8 bg-neutral min-h-screen">
      <div className="card max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center text-text-dark">Detalhes do Caminhão: {caminhao.placa}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <h2 className="text-xl font-bold mb-2">Dados Gerais</h2>
            <p><span className="font-bold">Placa:</span> {caminhao.placa}</p>
            <p><span className="font-bold">KM Atual:</span> {caminhao.km_atual}</p>
            <p><span className="font-bold">Qtd. de Pneus:</span> {caminhao.qtd_pneus}</p>
            {caminhao.numero_carreta && (
              <p><span className="font-bold">Nº Carreta:</span> {caminhao.numero_carreta}</p>
            )}
            {caminhao.numero_cavalo && (
              <p><span className="font-bold">Nº Cavalo:</span> {caminhao.numero_cavalo}</p>
            )}
          </div>
          <div className="card md:col-span-2">
            <h2 className="text-xl font-bold mb-2">Indicadores de Desempenho</h2>
            {consumoKmPorLitro !== null ? (
              <p className="text-xl font-bold text-secondary">
                Consumo Médio: {consumoKmPorLitro} Km/L
              </p>
            ) : (
              <p className="text-gray-500">
                Dados insuficientes para calcular o consumo.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Gastos Recentes</h2>
            {gastos.length === 0 ? <p className="text-text-light">Nenhum gasto encontrado.</p> : (
              <ul className="space-y-2">
                {gastos.slice(0, 5).map(g => (
                  <li key={g.id} className="flex justify-between items-center bg-gray-100 p-2 rounded">
                    <span>
                      <span className="font-bold">{g.tipos_gastos?.nome_tipo}</span> R$ {g.valor} ({g.data_gasto})
                    </span>
                    <Link to={`/gasto/editar/${g.id}`} className="btn-secondary text-sm px-2 py-1">
                      Editar
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Checklists de Manutenção</h2>
            {checklists.length === 0 ? <p className="text-text-light">Nenhum checklist encontrado.</p> : (
              <ul className="space-y-2">
                {checklists.slice(0, 5).map(c => (
                  <li key={c.id} className="flex justify-between items-center bg-gray-100 p-2 rounded">
                    <span>
                      <span className="font-bold">{c.itens_checklist?.nome_item}:</span> {c.data_manutencao} - {c.observacao}
                    </span>
                    <Link to={`/checklist/editar/${c.id}`} className="btn-secondary text-sm px-2 py-1">
                      Editar
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">Pneus</h2>
            {pneus.length === 0 ? <p className="text-text-light">Nenhum pneu encontrado.</p> : (
              <ul className="space-y-2">
                {pneus.map(p => (
                  <li key={p.id} className="flex justify-between items-center bg-gray-100 p-2 rounded">
                    <span>
                      <span className="font-bold">{p.posicoes_pneus?.nome_posicao}:</span> {p.status_pneus?.nome_status} - {p.marca} ({p.km_instalacao}km)
                    </span>
                    <Link to={`/pneu/editar/${p.id}`} className="btn-secondary text-sm px-2 py-1">
                      Editar
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaminhaoDetail;