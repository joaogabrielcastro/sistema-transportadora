// src/pages/EditCaminhao.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

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

const EditCaminhao = () => {
  const { placa } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    placa: '',
    qtd_pneus: '',
    km_atual: '',
    numero_carreta: '',
    numero_cavalo: '',
    motorista: '' // Novo campo
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchCaminhao = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await axios.get(`${API_URL}/api/caminhoes/${placa}`);
        const caminhao = response.data;
        
        setFormData({
          placa: caminhao.placa || '',
          qtd_pneus: caminhao.qtd_pneus || '',
          km_atual: caminhao.km_atual || '',
          numero_carreta: caminhao.numero_carreta || '',
          numero_cavalo: caminhao.numero_cavalo || '',
          motorista: caminhao.motorista || '' // Novo campo
        });
      } catch (err) {
        console.error('Erro completo:', err);
        console.error('Resposta do servidor:', err.response?.data);
        setError('Erro ao carregar dados do caminhão. Verifique a conexão com o servidor.');
      } finally {
        setLoading(false);
      }
    };
    fetchCaminhao();
  }, [placa]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    let formattedValue = value;
    
    // Formatação específica para o campo motorista
    if (name === 'motorista') {
      // Permite apenas letras, espaços e acentos
      formattedValue = value.replace(/[^a-zA-ZÀ-ÿ\s]/g, "");
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: formattedValue
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage('');

    try {
      const payload = {
        qtd_pneus: formData.qtd_pneus ? parseInt(formData.qtd_pneus) : null,
        km_atual: formData.km_atual ? parseInt(formData.km_atual) : null,
        numero_carreta: formData.numero_carreta ? parseInt(formData.numero_carreta) : null,
        numero_cavalo: formData.numero_cavalo ? parseInt(formData.numero_cavalo) : null,
        motorista: formData.motorista.trim() || null // Novo campo
      };

      console.log('Enviando dados atualizados do caminhão:', payload);

      await axios.put(`${API_URL}/api/caminhoes/${placa}`, payload);
      
      setSuccessMessage('Caminhão atualizado com sucesso!');
      
      // Redireciona após 2 segundos
      setTimeout(() => {
        navigate(`/caminhao/${placa}`);
      }, 2000);

    } catch (err) {
      console.error('Erro completo:', err);
      console.error('Resposta do servidor:', err.response?.data);
      setError(
        err.response?.data?.error || 
        err.response?.data?.message || 
        'Erro ao atualizar caminhão. Verifique os dados e tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!formData.placa) return <div className="text-center mt-10 text-gray-600">Caminhão não encontrado para edição.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Link 
            to={`/caminhao/${placa}`} 
            className="flex items-center text-blue-600 hover:text-blue-800 mr-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Voltar para o Caminhão
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">Editar Caminhão: {placa}</h1>
        </div>

        {/* Mensagens de Feedback */}
        {error && <ErrorMessage message={error} />}
        {successMessage && <SuccessMessage message={successMessage} />}

        {/* Formulário */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Placa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Placa
                </label>
                <input
                  type="text"
                  name="placa"
                  value={formData.placa}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-gray-100"
                  required
                  disabled
                />
                <p className="text-sm text-gray-500 mt-1">
                  A placa não pode ser alterada
                </p>
              </div>

              {/* Motorista */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motorista
                </label>
                <input
                  type="text"
                  name="motorista"
                  value={formData.motorista}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Nome do motorista responsável"
                  maxLength={100}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Nome completo do motorista
                </p>
              </div>

              {/* Quantidade de Pneus */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantidade de Pneus *
                </label>
                <input
                  type="number"
                  name="qtd_pneus"
                  value={formData.qtd_pneus}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  min="0"
                  max="20"
                  required
                  placeholder="Ex: 6, 8, 10"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Número total de pneus do veículo
                </p>
              </div>

              {/* KM Atual */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  KM Atual *
                </label>
                <input
                  type="number"
                  name="km_atual"
                  value={formData.km_atual}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  min="0"
                  required
                  placeholder="Quilometragem atual"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Quilometragem atual do hodômetro
                </p>
              </div>

              {/* Número da Carreta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número da Carreta
                </label>
                <input
                  type="number"
                  name="numero_carreta"
                  value={formData.numero_carreta}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  min="0"
                  max="100"
                  placeholder="0-100 (opcional)"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Número de identificação da carreta
                </p>
              </div>

              {/* Número do Cavalo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número do Cavalo
                </label>
                <input
                  type="number"
                  name="numero_cavalo"
                  value={formData.numero_cavalo}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  min="101"
                  placeholder="101+ (opcional)"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Número de identificação do cavalo mecânico
                </p>
              </div>
            </div>

            {/* Informações Adicionais */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Informações Importantes</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• A placa do veículo não pode ser alterada</li>
                <li>• Atualize o KM atual sempre que houver manutenções ou abastecimentos</li>
                <li>• A quantidade de pneus deve refletir a configuração real do veículo</li>
                <li>• O motorista é opcional, mas recomendado para melhor controle</li>
              </ul>
            </div>

            {/* Botões */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate(`/caminhao/${placa}`)}
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

export default EditCaminhao;