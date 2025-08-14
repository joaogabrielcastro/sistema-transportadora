// src/pages/EditCaminhao.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const EditCaminhao = () => {
  const { placa } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    placa: '',
    qtd_pneus: 0,
    km_atual: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCaminhao = async () => {
      try {
        const response = await axios.get(`http://localhost:3000/api/caminhoes/${placa}`);
        setFormData(response.data);
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
    setFormData({ ...formData, [name]: name === 'qtd_pneus' || name === 'km_atual' ? parseInt(value) : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:3000/api/caminhoes/${placa}`, formData);
      alert('Caminhão atualizado com sucesso!');
      navigate(`/caminhao/${placa}`); // Redireciona para a tela de detalhes
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
          <div className="mb-6">
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