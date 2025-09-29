// src/pages/EditGasto.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";

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

const SuccessMessage = ({ message }) => (
  <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-lg mb-6">
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
  </div>
);

const EditGasto = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caminhaoPlaca, setCaminhaoPlaca] = useState("");
  const [formData, setFormData] = useState({
    caminhao_id: "",
    tipo_gasto_id: "",
    valor: "",
    data_gasto: "",
    descricao: "",
    km_registro: "",
    quantidade_combustivel: "",
  });
  const [tiposGastos, setTiposGastos] = useState([]);
  const [caminhoes, setCaminhoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  // IDs dos tipos de gasto especiais
  const ID_TIPO_GASTO_COMBUSTIVEL = 9;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [gastoRes, tiposRes, caminhoesRes] = await Promise.all([
          axios.get(`${API_URL}/api/gastos/${id}`),
          axios.get(`${API_URL}/api/tipos-gastos`),
          axios.get(`${API_URL}/api/caminhoes`),
        ]);

        const gastoData = gastoRes.data;
        setCaminhaoPlaca(gastoData.caminhoes?.placa || "");

        setFormData({
          caminhao_id: gastoData.caminhao_id || "",
          tipo_gasto_id: gastoData.tipo_gasto_id || "",
          valor: gastoData.valor || "",
          data_gasto: gastoData.data_gasto ? 
            new Date(gastoData.data_gasto).toISOString().split('T')[0] : '',
          descricao: gastoData.descricao || "",
          km_registro: gastoData.km_registro || "",
          quantidade_combustivel: gastoData.quantidade_combustivel || "",
        });

        setTiposGastos(tiposRes.data);
        setCaminhoes(caminhoesRes.data);
      } catch (err) {
        console.error('Erro completo:', err);
        console.error('Resposta do servidor:', err.response?.data);
        setError('Erro ao carregar dados do gasto. Verifique a conexão com o servidor.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCaminhaoChange = (e) => {
    const caminhaoId = e.target.value;
    const caminhaoSelecionado = caminhoes.find(
      (c) => c.id === parseInt(caminhaoId)
    );

    setFormData(prev => ({
      ...prev,
      caminhao_id: caminhaoId,
      km_registro: caminhaoSelecionado?.km_atual || prev.km_registro,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage("");

    try {
      const isCombustivel = parseInt(formData.tipo_gasto_id) === ID_TIPO_GASTO_COMBUSTIVEL;
      
      const payload = {
        caminhao_id: parseInt(formData.caminhao_id),
        tipo_gasto_id: parseInt(formData.tipo_gasto_id),
        valor: parseFloat(formData.valor),
        data_gasto: formData.data_gasto,
        descricao: formData.descricao,
        km_registro: formData.km_registro ? parseInt(formData.km_registro) : null,
        quantidade_combustivel: isCombustivel && formData.quantidade_combustivel ? 
          parseFloat(formData.quantidade_combustivel) : null,
      };

      console.log('Enviando dados atualizados do gasto:', payload);

      await axios.put(`${API_URL}/api/gastos/${id}`, payload);
      
      setSuccessMessage('Gasto atualizado com sucesso!');
      
      // Redireciona após 2 segundos
      setTimeout(() => {
        navigate('/manutencao-gastos');
      }, 2000);

    } catch (err) {
      console.error('Erro completo:', err);
      console.error('Resposta do servidor:', err.response?.data);
      setError(
        err.response?.data?.error || 
        err.response?.data?.message || 
        'Erro ao atualizar o gasto. Verifique os dados e tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isCombustivel = parseInt(formData.tipo_gasto_id) === ID_TIPO_GASTO_COMBUSTIVEL;
  const caminhaoSelecionado = caminhoes.find(c => c.id === parseInt(formData.caminhao_id));

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Link 
            to={caminhaoPlaca ? `/caminhao/${caminhaoPlaca}` : '/manutencao-gastos'} 
            className="flex items-center text-blue-600 hover:text-blue-800 mr-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">Editar Gasto</h1>
        </div>

        {/* Mensagens de Feedback */}
        {error && <ErrorMessage message={error} />}
        {successMessage && <SuccessMessage message={successMessage} />}

        {/* Formulário */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Caminhão */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Caminhão
                </label>
                <select 
                  name="caminhao_id" 
                  value={formData.caminhao_id} 
                  onChange={handleCaminhaoChange} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  disabled
                >
                  <option value="">Selecione o Caminhão</option>
                  {caminhoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.placa} - KM: {c.km_atual?.toLocaleString('pt-BR')}
                    </option>
                  ))}
                </select>
                {caminhaoSelecionado && (
                  <p className="text-sm text-gray-500 mt-1">
                    KM atual: {caminhaoSelecionado.km_atual?.toLocaleString('pt-BR')}
                  </p>
                )}
              </div>

              {/* Tipo de Gasto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Gasto *
                </label>
                <select 
                  name="tipo_gasto_id" 
                  value={formData.tipo_gasto_id} 
                  onChange={handleChange} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                >
                  <option value="">Selecione o Tipo</option>
                  {tiposGastos.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nome_tipo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Valor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  name="valor"
                  value={formData.valor}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0,00"
                />
              </div>

              {/* Data */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data do Gasto *
                </label>
                <input
                  type="date"
                  name="data_gasto"
                  value={formData.data_gasto}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Quilometragem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quilometragem (KM)
                </label>
                <input
                  type="number"
                  name="km_registro"
                  value={formData.km_registro}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  min="0"
                  placeholder="KM no momento do gasto"
                />
              </div>

              {/* Quantidade de Combustível (apenas para combustível) */}
              {isCombustivel && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantidade (Litros) *
                  </label>
                  <input
                    type="number"
                    name="quantidade_combustivel"
                    value={formData.quantidade_combustivel}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0,00"
                  />
                </div>
              )}
            </div>

            {/* Observação */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observação
              </label>
              <textarea
                name="descricao"
                value={formData.descricao}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Detalhes adicionais sobre o gasto..."
              />
            </div>

            {/* Botões */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate(caminhaoPlaca ? `/caminhao/${caminhaoPlaca}` : '/manutencao-gastos')}
                className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors font-medium"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {submitting ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditGasto;