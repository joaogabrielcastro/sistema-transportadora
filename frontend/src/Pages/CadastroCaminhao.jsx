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

const CarretaField = ({
  label,
  value,
  onChange,
  onRemove,
  showRemove,
  error,
  placeholder = "0-99",
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
        className={`flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:border-blue-500 transition-colors ${
          error
            ? "border-red-300 focus:ring-red-500"
            : "border-gray-300 focus:ring-blue-500"
        }`}
        placeholder={placeholder}
        maxLength={2}
      />
      {showRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      )}
    </div>
    {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
  </div>
);

const CadastroCaminhao = () => {
  const [form, setForm] = useState({
    placa: "",
    qtd_pneus: "",
    km_atual: "",
    numero_cavalo: "",
    motorista: "",
  });

  const [carretas, setCarretas] = useState([""]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess("");
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const validatePlaca = (placa) => {
    const placaRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i;
    return placaRegex.test(placa.replace(/-/g, ""));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.placa.trim()) {
      newErrors.placa = "Placa é obrigatória";
    } else if (!validatePlaca(form.placa)) {
      newErrors.placa = "Formato de placa inválido (ex: ABC1D23 ou ABC-1D23)";
    }

    if (!form.qtd_pneus || parseInt(form.qtd_pneus) <= 0) {
      newErrors.qtd_pneus = "Quantidade de pneus deve ser maior que zero";
    }

    if (!form.km_atual || parseInt(form.km_atual) < 0) {
      newErrors.km_atual = "KM atual deve ser um número positivo";
    } else if (parseInt(form.km_atual) > 5000000) {
      newErrors.km_atual = "KM atual não pode ser maior que 5.000.000";
    }

    // Validação das carretas
    const carretasPreenchidas = carretas.filter(
      (carreta) => carreta.trim() !== ""
    );
    if (carretasPreenchidas.length > 0) {
      carretasPreenchidas.forEach((carreta, index) => {
        if (!/^[0-9]+$/.test(carreta)) {
          newErrors[`carreta_${index}`] = "Apenas números são permitidos";
        } else if (parseInt(carreta) < 0 || parseInt(carreta) > 99) {
          newErrors[`carreta_${index}`] = "Número deve estar entre 0 e 99";
        }
      });
    }

    if (form.numero_cavalo && parseInt(form.numero_cavalo) < 100) {
      newErrors.numero_cavalo = "Número do cavalo deve ser 100 ou maior";
    }

    if (!form.motorista.trim()) {
      newErrors.motorista = "Nome do motorista é obrigatório";
    } else if (form.motorista.length < 3) {
      newErrors.motorista =
        "Nome do motorista deve ter pelo menos 3 caracteres";
    } else if (form.motorista.length > 100) {
      newErrors.motorista =
        "Nome do motorista não pode ter mais de 100 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatPlaca = (value) => {
    const cleaned = value
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 7);

    // Formata como Mercosul: ABC1D23
    if (cleaned.length === 7) {
      return cleaned.replace(
        /([A-Z]{3})([0-9])([A-Z0-9])([0-9]{2})/,
        "$1$2$3$4"
      );
    }
    return cleaned;
  };

  const handleInputChange = (field, value) => {
    let formattedValue = value;

    if (field === "placa") {
      formattedValue = formatPlaca(value);
    } else if (["qtd_pneus", "km_atual", "numero_cavalo"].includes(field)) {
      formattedValue = value.replace(/[^0-9]/g, "");
    } else if (field === "motorista") {
      formattedValue = value.replace(/[^a-zA-ZÀ-ÿ\s]/g, "");
    }

    setForm((prev) => ({
      ...prev,
      [field]: formattedValue,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleCarretaChange = (index, value) => {
    const newCarretas = [...carretas];
    // Permite apenas números e limita a 2 dígitos
    newCarretas[index] = value.replace(/[^0-9]/g, "").slice(0, 2);
    setCarretas(newCarretas);

    // Limpa erro específico da carreta
    if (errors[`carreta_${index}`]) {
      setErrors((prev) => {
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
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`carreta_${index}`];
        return newErrors;
      });
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
      const carretasPreenchidas = carretas.filter(
        (carreta) => carreta.trim() !== ""
      );

      const payload = {
        placa: form.placa.replace(/-/g, ""),
        qtd_pneus: parseInt(form.qtd_pneus),
        km_atual: parseInt(form.km_atual),
        numero_cavalo: form.numero_cavalo ? parseInt(form.numero_cavalo) : null,
        motorista: form.motorista.trim(),
        numero_carreta_1: carretasPreenchidas[0]
          ? parseInt(carretasPreenchidas[0])
          : null,
        numero_carreta_2: carretasPreenchidas[1]
          ? parseInt(carretasPreenchidas[1])
          : null,
      };

      console.log("📤 PAYLOAD ENVIADO:", payload);

      const response = await axios.post(`${API_URL}/api/caminhoes`, payload);
      console.log("✅ CADASTRO REALIZADO:", response.data);

      setSuccess("Caminhão cadastrado com sucesso!");
      setForm({
        placa: "",
        qtd_pneus: "",
        km_atual: "",
        numero_cavalo: "",
        motorista: "",
      });
      setCarretas([""]);
      setErrors({});

      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err) {
      console.log("🔴 ERRO:", err.response?.data);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Erro ao cadastrar caminhão";
      setError(errorMessage);
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
        <div className="bg-white rounded-2xl shadow-xl p-8">
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

          {success && (
            <SuccessMessage message={success} onClose={() => setSuccess("")} />
          )}

          {error && <ErrorMessage message={error} onRetry={handleSubmit} />}

          <form onSubmit={handleSubmit}>
            <FormField
              label="Placa do Veículo"
              value={form.placa}
              onChange={(e) => handleInputChange("placa", e.target.value)}
              required
              placeholder="Ex: ABC1D23"
              maxLength={7}
              error={errors.placa}
              helpText="Digite a placa no formato mercosul (ABC1D23)"
            />

            <FormField
              label="Nome do Motorista"
              value={form.motorista}
              onChange={(e) => handleInputChange("motorista", e.target.value)}
              required
              placeholder="Ex: João Silva"
              error={errors.motorista}
              helpText="Nome completo do motorista responsável"
            />

            <FormField
              label="Quantidade de Pneus"
              type="number"
              value={form.qtd_pneus}
              onChange={(e) => handleInputChange("qtd_pneus", e.target.value)}
              required
              min="1"
              max="100"
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

            {/* SEÇÃO DE CARRETAS */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  error={errors[`carreta_${index}`]}
                  placeholder="0-99"
                />
              ))}

              {carretas.length < 2 && (
                <button
                  type="button"
                  onClick={addCarreta}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors mt-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Adicionar outra carreta
                </button>
              )}
            </div>

            <FormField
              label="Número do Cavalo"
              type="number"
              value={form.numero_cavalo}
              onChange={(e) =>
                handleInputChange("numero_cavalo", e.target.value)
              }
              min="100"
              max="999"
              placeholder="100+"
              error={errors.numero_cavalo}
              helpText="Número único do cavalo mecânico"
            />

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
