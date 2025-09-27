// src/pages/CadastroCaminhao.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

// Componentes Reutilizáveis
const SuccessMessage = ({ message, onClose }) => (
  <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-lg mb-6">
    <div className="flex justify-between items-center">
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
      <button
        onClick={onClose}
        className="text-green-700 hover:text-green-900 ml-4"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>
);

const ErrorMessage = ({ message, onRetry }) => (
  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
    <div className="flex justify-between items-center">
      <p className="font-medium">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-4 bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors"
        >
          Tentar Novamente
        </button>
      )}
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-4">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
  </div>
);

const FormField = ({
  label,
  type = "text",
  value,
  onChange,
  required = false,
  placeholder = "",
  min,
  max,
  step,
  helpText,
  error,
}) => (
  <div className="mb-6">
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-blue-500 transition-colors ${
        error
          ? "border-red-300 focus:ring-red-500"
          : "border-gray-300 focus:ring-blue-500"
      }`}
      required={required}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
    />
    {helpText && <p className="text-sm text-gray-500 mt-1">{helpText}</p>}
    {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
  </div>
);

const CadastroCaminhao = () => {
  const [form, setForm] = useState({
    placa: "",
    qtd_pneus: "",
    km_atual: "",
    numero_carreta: "",
    numero_cavalo: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL;

  // Limpar mensagens após tempo
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess("");
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  // Validar placa no formato brasileiro
  const validatePlaca = (placa) => {
    const placaRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i;
    return placaRegex.test(placa.replace(/-/g, ""));
  };

  // Validar formulário
  const validateForm = () => {
    const newErrors = {};

    // Validação da placa
    if (!form.placa.trim()) {
      newErrors.placa = "Placa é obrigatória";
    } else if (!validatePlaca(form.placa)) {
      newErrors.placa = "Formato de placa inválido (ex: ABC1D23 ou ABC-1D23)";
    }

    // Validação quantidade de pneus
    if (!form.qtd_pneus || parseInt(form.qtd_pneus) <= 0) {
      newErrors.qtd_pneus = "Quantidade de pneus deve ser maior que zero";
    } else if (parseInt(form.qtd_pneus) > 20) {
      newErrors.qtd_pneus = "Quantidade de pneus não pode ser maior que 20";
    }

    // Validação KM atual
    if (!form.km_atual || parseInt(form.km_atual) < 0) {
      newErrors.km_atual = "KM atual deve ser um número positivo";
    } else if (parseInt(form.km_atual) > 5000000) {
      newErrors.km_atual = "KM atual não pode ser maior que 5.000.000";
    }

    // Validação número da carreta
    if (
      form.numero_carreta &&
      (parseInt(form.numero_carreta) < 0 || parseInt(form.numero_carreta) > 100)
    ) {
      newErrors.numero_carreta = "Número da carreta deve estar entre 0 e 100";
    }

    // Validação número do cavalo
    if (form.numero_cavalo && parseInt(form.numero_cavalo) < 101) {
      newErrors.numero_cavalo = "Número do cavalo deve ser 101 ou maior";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Formatadores de input
  const formatPlaca = (value) => {
    // Limpa, coloca em maiúsculas e limita a 7 caracteres
    const cleaned = value
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 7);
    return cleaned;
  };

  const handleInputChange = (field, value) => {
    let formattedValue = value;

    if (field === "placa") {
      formattedValue = formatPlaca(value);
    } else if (
      ["qtd_pneus", "km_atual", "numero_carreta", "numero_cavalo"].includes(
        field
      )
    ) {
      // Remove caracteres não numéricos, exceto para campos vazios
      formattedValue = value.replace(/[^0-9]/g, "");
    }

    setForm((prev) => ({
      ...prev,
      [field]: formattedValue,
    }));

    // Limpar erro do campo quando usuário começar a digitar
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      const payload = {
        placa: form.placa.replace(/-/g, ""),
        qtd_pneus: parseInt(form.qtd_pneus),
        km_atual: parseInt(form.km_atual),
        numero_carreta: form.numero_carreta
          ? parseInt(form.numero_carreta)
          : null,
        numero_cavalo: form.numero_cavalo ? parseInt(form.numero_cavalo) : null,
      };

      await axios.post(`${API_URL}/api/caminhoes`, payload);

      setSuccess("Caminhão cadastrado com sucesso!");
      setForm({
        placa: "",
        qtd_pneus: "",
        km_atual: "",
        numero_carreta: "",
        numero_cavalo: "",
      });
      setErrors({});

      // Redirecionar após 2 segundos
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        "Erro ao cadastrar caminhão. Verifique os dados e tente novamente.";
      setError(errorMessage);
      console.error("Erro ao cadastrar caminhão:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Card Principal */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Cadastrar Caminhão
            </h1>
            <p className="text-gray-600">Adicione um novo veículo à frota</p>
          </div>

          {/* Mensagens de Feedback */}
          {success && (
            <SuccessMessage message={success} onClose={() => setSuccess("")} />
          )}

          {error && <ErrorMessage message={error} onRetry={handleSubmit} />}

          {/* Formulário */}
          <form onSubmit={handleSubmit}>
            <FormField
              label="Placa do Veículo"
              value={form.placa}
              onChange={(e) => handleInputChange("placa", e.target.value)}
              required
              placeholder="Ex: ABC-1D23"
              maxLength={8}
              error={errors.placa}
              helpText="Digite a placa no formato mercosul (ABC1D23)"
            />
            <FormField
              label="Quantidade de Pneus"
              type="number"
              value={form.qtd_pneus}
              onChange={(e) => handleInputChange("qtd_pneus", e.target.value)}
              required
              min="1"
              max="20"
              placeholder="Ex: 6"
              error={errors.qtd_pneus}
              helpText="Número total de pneus do veículo"
            />
            <FormField
              label="Quilometragem Atual (KM)"
              type="number"
              value={form.km_atual}
              onChange={(e) => handleInputChange("km_atual", e.target.value)}
              required
              min="0"
              max="5000000"
              placeholder="Ex: 150000"
              error={errors.km_atual}
              helpText="Quilometragem atual do hodômetro"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Número da Carreta"
                type="number"
                value={form.numero_carreta}
                onChange={(e) =>
                  handleInputChange("numero_carreta", e.target.value)
                }
                min="0"
                max="100"
                placeholder="0-100"
                error={errors.numero_carreta}
              />

              <FormField
                label="Número do Cavalo"
                type="number"
                value={form.numero_cavalo}
                onChange={(e) =>
                  handleInputChange("numero_cavalo", e.target.value)
                }
                min="101"
                placeholder="101+"
                error={errors.numero_cavalo}
              />
            </div>
            {/* Botões de Ação */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <button
                type="button"
                onClick={handleGoBack}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={loading}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <LoadingSpinner />
                    <span className="ml-2">Cadastrando...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Cadastrar Caminhão
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CadastroCaminhao;
