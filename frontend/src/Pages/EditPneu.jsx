// src/pages/EditPneu.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const EditPneu = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    caminhao_id: '',
    posicao_id: '',
    status_id: '',
    vida_util_km: '',
    marca: '',
    modelo: '',
    data_instalacao: '',
    km_instalacao: '',
    observacao: '',
  });
  const [caminhoes, setCaminhoes] = useState([]);
  const [posicoes, setPosicoes] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pneuRes, caminhoesRes, posicoesRes, statusRes] = await Promise.all([
          axios.get(`${API_URL}/api/pneus/${id}`),
          axios.get(`${API_URL}/api/caminhoes`),
          axios.get(`${API_URL}/api/posicoes-pneus`),
          axios.get(`${API_URL}/api/status-pneus`),
        ]);
        setFormData({
          caminhao_id: pneuRes.data.caminhao_id,
          posicao_id: pneuRes.data.posicao_id,
          status_id: pneuRes.data.status_id,
          vida_util_km: pneuRes.data.vida_util_km,
          marca: pneuRes.data.marca,
          modelo: pneuRes.data.modelo,
          data_instalacao: pneuRes.data.data_instalacao,
          km_instalacao: pneuRes.data.km_instalacao,
          observacao: pneuRes.data.observacao,
        });
        setCaminhoes(caminhoesRes.data);
        setPosicoes(posicoesRes.data);
        setStatusList(statusRes.data);
      } catch (err) {
        setError('Erro ao carregar dados para edição.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/pneus/${id}`, formData);
      alert('Pneu atualizado com sucesso!');
      navigate('/pneus'); // Redireciona de volta para a lista
    } catch (err) {
      setError('Erro ao atualizar o pneu.');
      console.error(err);
    }
  };

  if (loading) return <div className="text-center mt-10">Carregando...</div>;
  if (error) return <div className="text-center mt-10 text-accent">{error}</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Editar Pneu</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="label">Caminhão</label>
            <select name="caminhao_id" value={formData.caminhao_id} onChange={handleChange} className="input" disabled>
              {caminhoes.map((c) => (
                <option key={c.id} value={c.id}>{c.placa}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="label">Posição</label>
            <select name="posicao_id" value={formData.posicao_id} onChange={handleChange} className="input" required>
              {posicoes.map((p) => (
                <option key={p.id} value={p.id}>{p.nome_posicao}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="label">Status</label>
            <select name="status_id" value={formData.status_id} onChange={handleChange} className="input" required>
              {statusList.map((s) => (
                <option key={s.id} value={s.id}>{s.nome_status}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="label">Vida Útil (KM)</label>
            <input
              type="number"
              name="vida_util_km"
              value={formData.vida_util_km}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <div className="mb-4">
            <label className="label">Marca</label>
            <input
              type="text"
              name="marca"
              value={formData.marca}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <div className="mb-4">
            <label className="label">Modelo</label>
            <input
              type="text"
              name="modelo"
              value={formData.modelo}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <div className="mb-4">
            <label className="label">Data de Instalação</label>
            <input
              type="date"
              name="data_instalacao"
              value={formData.data_instalacao}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <div className="mb-4">
            <label className="label">KM na Instalação</label>
            <input
              type="number"
              name="km_instalacao"
              value={formData.km_instalacao}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <div className="mb-6">
            <label className="label">Observação</label>
            <textarea
              name="observacao"
              value={formData.observacao}
              onChange={handleChange}
              className="input"
            ></textarea>
          </div>
          <button type="submit" className="w-full btn-primary">
            Salvar Alterações
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditPneu;