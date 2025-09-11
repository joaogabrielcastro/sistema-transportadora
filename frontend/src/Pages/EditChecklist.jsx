// src/pages/EditChecklist.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const EditChecklist = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    caminhao_id: '',
    item_id: '',
    data_manutencao: '',
    observacao: '',
  });
  const [caminhoes, setCaminhoes] = useState([]);
  const [itensChecklist, setItensChecklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [checklistRes, caminhoesRes, itensRes] = await Promise.all([
          axios.get(`${API_URL}/api/checklist/${id}`),
          axios.get(`${API_URL}/api/caminhoes`),
          axios.get(`${API_URL}/api/itens-checklist`),
        ]);
        setFormData({
          caminhao_id: checklistRes.data.caminhao_id,
          item_id: checklistRes.data.item_id,
          data_manutencao: checklistRes.data.data_manutencao,
          observacao: checklistRes.data.observacao,
        });
        setCaminhoes(caminhoesRes.data);
        setItensChecklist(itensRes.data);
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
      await axios.put(`${API_URL}/api/checklist/${id}`, formData);
      alert('Item de checklist atualizado com sucesso!');
      navigate('/manutencao-gastos'); // Redireciona de volta para a tela unificada
    } catch (err) {
      setError('Erro ao atualizar o item de checklist.');
      console.error(err);
    }
  };

  if (loading) return <div className="text-center mt-10">Carregando...</div>;
  if (error) return <div className="text-center mt-10 text-accent">{error}</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral">
      <div className="card w-full max-w-md">
        <Link to="/manutencao-gastos" className="btn-secondary mb-4 inline-block">← Voltar</Link>
        <h1 className="text-2xl font-bold mb-6 text-center">Editar Checklist</h1>
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
            <label className="label">Item</label>
            <select name="item_id" value={formData.item_id} onChange={handleChange} className="input" required>
              <option value="">Selecione...</option>
              {itensChecklist.map((item) => (
                <option key={item.id} value={item.id}>{item.nome_item}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="label">Data da Manutenção</label>
            <input
              type="date"
              name="data_manutencao"
              value={formData.data_manutencao}
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

export default EditChecklist;