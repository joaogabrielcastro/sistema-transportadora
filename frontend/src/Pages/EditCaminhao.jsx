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

// NOVO COMPONENTE para campo de carreta
const CarretaField = ({ 
  label, 
  value, 
  onChange, 
  onRemove, 
  showRemove, 
  error,
  placeholder = "Número da carreta"
}) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label}
    </label>
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={onChange}
        className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:border-blue-500 transition-colors ${
          error
            ? "border-red-300 focus:ring-red-500"
            : "border-gray-300 focus:ring-blue-500"
        }`}
        placeholder={placeholder}
      />
      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
    {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
  </div>
);

const EditCaminhao = () => {
  const { placa } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    placa: '',
    qtd_pneus: '',
    km_atual: '',
    numero_cavalo: '',
    motorista: ''
  });
  
  // NOVO ESTADO para carretas
  const [carretas, setCarretas] = useState([""]);
  const [carretasErrors, setCarretasErrors] = useState({});
  
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
          numero_cavalo: caminhao.numero_cavalo || '',
          motorista: caminhao.motorista || ''
        });

        // INICIALIZA AS CARRETAS - pega ambas as carretas do banco
        const carretasArray = [];
        if (caminhao.numero_carreta_1) carretasArray.push(String(caminhao.numero_carreta_1));
        if (caminhao.numero_carreta_2) carretasArray.push(String(caminhao.numero_carreta_2));
        
        // Se não tiver nenhuma carreta, começa com um campo vazio
        setCarretas(carretasArray.length > 0 ? carretasArray : [""]);
        
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

  // NOVAS FUNÇÕES para gerenciar carretas
  const handleCarretaChange = (index, value) => {
    const newCarretas = [...carretas];
    // Permite apenas números
    newCarretas[index] = value.replace(/[^0-9]/g, "");
    setCarretas(newCarretas);

    // Limpa erro específico da carreta
    if (carretasErrors[`carreta_${index}`]) {
      setCarretasErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`carreta_${index}`];
        return newErrors;
      });
    }
  };

  const addCarreta = () => {
    if (carretas.length < 2) {
      setCarretas([...carretas, ""]);
    }
  };

  const removeCarreta = (index) => {
    if (carretas.length > 1) {
      const newCarretas = carretas.filter((_, i) => i !== index);
      setCarretas(newCarretas);
      
      // Limpa erro da carreta removida
      setCarretasErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`carreta_${index}`];
        return newErrors;
      });
    }
  };

  // VALIDAÇÃO DAS CARRETAS
  const validateCarretas = () => {
    const newErrors = {};
    const carretasPreenchidas = carretas.filter(carreta => carreta.trim() !== "");
    
    if (carretasPreenchidas.length > 0) {
      carretasPreenchidas.forEach((carreta, index) => {
        if (!/^[0-9]+$/.test(carreta)) {
          newErrors[`carreta_${index}`] = "Apenas números são permitidos";
        } else if (parseInt(carreta) < 0 || parseInt(carreta) > 100) {
          newErrors[`carreta_${index}`] = "Número deve estar entre 0 e 100";
        }
      });
    }
    
    setCarretasErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage('');

    // Valida as carretas antes de enviar
    if (!validateCarretas()) {
      setSubmitting(false);
      return;
    }

    try {
      const carretasPreenchidas = carretas.filter(carreta => carreta.trim() !== "");
      
      const payload = {
        qtd_pneus: formData.qtd_pneus ? parseInt(formData.qtd_pneus) : null,
        km_atual: formData.km_atual ? parseInt(formData.km_atual) : null,
        numero_cavalo: formData.numero_cavalo ? parseInt(formData.numero_cavalo) : null,
        motorista: formData.motorista.trim() || null,
        // ENVIA AMBAS AS CARRETAS COM OS NOMES CORRETOS
        numero_carreta_1: carretasPreenchidas[0] ? parseInt(carretasPreenchidas[0]) : null,
        numero_carreta_2: carretasPreenchidas[1] ? parseInt(carretasPreenchidas[1]) : null,
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

            {/* SEÇÃO DE CARRETAS - NOVA */}
            <div className="border-t pt-6">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Carretas
              </label>
              
              {carretas.map((carreta, index) => (
                <CarretaField
                  key={index}
                  label={`Carreta ${index + 1}`}
                  value={carreta}
                  onChange={(e) => handleCarretaChange(index, e.target.value)}
                  onRemove={() => removeCarreta(index)}
                  showRemove={carretas.length > 1}
                  error={carretasErrors[`carreta_${index}`]}
                  placeholder="Número da carreta"
                />
              ))}
              
              {carretas.length < 2 && (
                <button
                  type="button"
                  onClick={addCarreta}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors mt-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Adicionar outra carreta
                </button>
              )}
              
              <p className="text-sm text-gray-500 mt-1">
                Máximo 2 carretas. Deixe em branco se não houver carreta.
              </p>
            </div>

            {/* Informações Adicionais */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Informações Importantes</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• A placa do veículo não pode ser alterada</li>
                <li>• Atualize o KM atual sempre que houver manutenções ou abastecimentos</li>
                <li>• A quantidade de pneus deve refletir a configuração real do veículo</li>
                <li>• O motorista é opcional, mas recomendado para melhor controle</li>
                <li>• É possível cadastrar até 2 carretas por caminhão</li>
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