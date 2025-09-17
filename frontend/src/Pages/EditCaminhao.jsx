// src/pages/EditCaminhao.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const EditCaminhao = () => {
  const { placa } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    placa: '',
    qtd_pneus: 0,
    km_atual: 0,
    numero_carreta: '',
    numero_cavalo: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCaminhao = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/caminhoes/${placa}`);
        const caminhao = response.data;
        setFormData({
          placa: caminhao.placa,
          qtd_pneus: caminhao.qtd_pneus,
          km_atual: caminhao.km_atual,
          numero_carreta: caminhao.numero_carreta || '',
          numero_cavalo: caminhao.numero_cavalo || ''
        });
      } catch (err) {
        setError('Erro ao carregar dados do caminhão.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCaminhao();
  }, [placa]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ 
      ...formData, 
      [name]: (name === 'qtd_pneus' || name === 'km_atual' || name === 'numero_carreta' || name === 'numero_cavalo') 
        ? (value === '' ? '' : parseInt(value)) 
        : value 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/caminhoes/${placa}`, {
        qtd_pneus: parseInt(formData.qtd_pneus),
        km_atual: parseInt(formData.km_atual),
        numero_carreta: formData.numero_carreta ? parseInt(formData.numero_carreta) : null,
        numero_cavalo: formData.numero_cavalo ? parseInt(formData.numero_cavalo) : null
      });
      alert('Caminhão atualizado com sucesso!');
      navigate(`/caminhao/${placa}`);
    } catch (err) {
      setError('Erro ao atualizar caminhão. Verifique os dados e tente novamente.');
      console.error(err);
    }
  };

  if (loading) return <div className="text-center mt-10">Carregando...</div>;
  if (error) return <div className="text-center mt-10 text-accent">{error}</div>;
  if (!formData.placa) return <div className="text-center mt-10 text-text-dark">Caminhão não encontrado para edição.</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Editar Caminhão: {placa}</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="label" htmlFor="placa">Placa</label>
            <input
              type="text"
              id="placa"
              name="placa"
              value={formData.placa}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="qtdPneus">Quantidade de Pneus</label>
            <input
              type="number"
              id="qtdPneus"
              name="qtd_pneus"
              value={formData.qtd_pneus}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="kmAtual">KM Atual</label>
            <input
              type="number"
              id="kmAtual"
              name="km_atual"
              value={formData.km_atual}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <div className="mb-4">
            <label className="label" htmlFor="numeroCarreta">Número da Carreta (0-100)</label>
            <input
              type="number"
              id="numeroCarreta"
              name="numero_carreta"
              value={formData.numero_carreta}
              onChange={handleChange}
              className="input"
              min="0"
              max="100"
              placeholder="Opcional"
            />
          </div>
          <div className="mb-6">
            <label className="label" htmlFor="numeroCavalo">Número do Cavalo (101+)</label>
            <input
              type="number"
              id="numeroCavalo"
              name="numero_cavalo"
              value={formData.numero_cavalo}
              onChange={handleChange}
              className="input"
              min="101"
              placeholder="Opcional"
            />
          </div>
          <button
            type="submit"
            className="w-full btn-primary"
          >
            Salvar Alterações
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditCaminhao;