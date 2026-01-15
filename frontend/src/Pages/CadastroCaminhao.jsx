import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import {
  Card,
  Button,
  FormField,
  Alert,
  LoadingSpinner,
} from "../components/ui";

const CadastroCaminhao = () => {
  const navigate = useNavigate();
  const { post } = useApi();

  const [form, setForm] = useState({
    placa: "",
    qtd_pneus: "",
    km_atual: "",
    numero_cavalo: "",
    motorista: "",
    marca: "",
    modelo: "",
    ano: "",
    placa_carreta_1: "",
    placa_carreta_2: "",
  });

  const [carretas, setCarretas] = useState([""]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

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
    if (!placa) return true;
    const placaRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i;
    return placaRegex.test(placa.replace(/-/g, ""));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.placa.trim()) {
      newErrors.placa = "Placa é obrigatória";
    } else if (!validatePlaca(form.placa)) {
      newErrors.placa = "Formato inválido (ex: ABC1D23)";
    }

    if (form.placa_carreta_1 && !validatePlaca(form.placa_carreta_1)) {
      newErrors.placa_carreta_1 = "Formato inválido";
    }
    if (form.placa_carreta_2 && !validatePlaca(form.placa_carreta_2)) {
      newErrors.placa_carreta_2 = "Formato inválido";
    }

    if (!form.qtd_pneus || parseInt(form.qtd_pneus) <= 0) {
      newErrors.qtd_pneus = "Qtd. inválida";
    }

    if (!form.km_atual || parseInt(form.km_atual) < 0) {
      newErrors.km_atual = "KM inválido";
    }

    // Validação das carretas
    const carretasPreenchidas = carretas.filter((c) => c.trim() !== "");
    if (carretasPreenchidas.length > 0) {
      carretasPreenchidas.forEach((carreta, index) => {
        if (!/^[0-9]+$/.test(carreta)) {
          newErrors[`carreta_${index}`] = "Apenas números";
        } else if (parseInt(carreta) < 0 || parseInt(carreta) > 99) {
          newErrors[`carreta_${index}`] = "0-99";
        }
      });
    }

    if (form.numero_cavalo && form.numero_cavalo.trim() !== "") {
      const numeroCavalo = parseInt(form.numero_cavalo);
      if (isNaN(numeroCavalo) || numeroCavalo < 0) {
        newErrors.numero_cavalo = "Deve ser positivo";
      } else if (numeroCavalo > 9999) {
        newErrors.numero_cavalo = "Máximo 9999";
      }
    }

    if (!form.motorista.trim()) {
      newErrors.motorista = "Nome obrigatório";
    } else if (form.motorista.length < 3) {
      newErrors.motorista = "Mínimo 3 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatPlaca = (value) => {
    const cleaned = value
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 7);
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

    if (field.startsWith("placa")) {
      formattedValue = formatPlaca(value);
    } else if (
      ["qtd_pneus", "km_atual", "numero_cavalo", "ano"].includes(field)
    ) {
      formattedValue = value.replace(/[^0-9]/g, "");
    } else if (field === "motorista") {
      formattedValue = value.replace(/[^a-zA-ZÀ-ÿ\s]/g, "");
    }

    setForm((prev) => ({ ...prev, [field]: formattedValue }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleCarretaChange = (index, value) => {
    const newCarretas = [...carretas];
    newCarretas[index] = value.replace(/[^0-9]/g, "").slice(0, 2);
    setCarretas(newCarretas);

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
      const carretasPreenchidas = carretas.filter((c) => c.trim() !== "");

      const payload = {
        placa: form.placa.replace(/-/g, ""),
        qtd_pneus: parseInt(form.qtd_pneus),
        km_atual: parseInt(form.km_atual),
        numero_cavalo: parseInt(form.numero_cavalo),
        motorista: form.motorista.trim(),
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        ano: form.ano ? parseInt(form.ano) : null,
        numero_carreta_1: carretasPreenchidas[0]
          ? parseInt(carretasPreenchidas[0])
          : null,
        placa_carreta_1: form.placa_carreta_1.trim() || null,
        numero_carreta_2: carretasPreenchidas[1]
          ? parseInt(carretasPreenchidas[1])
          : null,
        placa_carreta_2: form.placa_carreta_2.trim() || null,
      };

      await post("/caminhoes", payload);
      setSuccess("Caminhão cadastrado com sucesso!");

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      console.error("Erro ao cadastrar:", err);
      // O useApi já extrai a mensagem de erro do backend e a coloca em err.message
      const errorMessage = err.message || "Erro ao cadastrar caminhão";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 md:px-8 flex justify-center">
      <div className="w-full max-w-2xl animate-fade-in">
        <Card
          title="Cadastrar Novo Caminhão"
          subtitle="Preencha os dados para adicionar um veículo à frota"
          className="shadow-lg"
        >
          {success && (
            <Alert type="success" message={success} className="mb-6" />
          )}
          {error && <Alert type="error" message={error} className="mb-6" />}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Placa do Veículo"
                name="placa"
                value={form.placa}
                onChange={(e) => handleInputChange("placa", e.target.value)}
                required
                placeholder="ABC1D23"
                maxLength={7}
                error={errors.placa}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
                    />
                  </svg>
                }
              />

              <FormField
                label="Número do Cavalo"
                name="numero_cavalo"
                type="number"
                value={form.numero_cavalo}
                onChange={(e) =>
                  handleInputChange("numero_cavalo", e.target.value)
                }
                placeholder="100+"
                error={errors.numero_cavalo}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                    />
                  </svg>
                }
              />
            </div>

            <FormField
              label="Nome do Motorista"
              name="motorista"
              value={form.motorista}
              onChange={(e) => handleInputChange("motorista", e.target.value)}
              required
              placeholder="Nome completo"
              error={errors.motorista}
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              }
            />

            {/* Dados do Veículo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                label="Marca"
                name="marca"
                value={form.marca}
                onChange={(e) => handleInputChange("marca", e.target.value)}
                placeholder="Ex: Scania, Volvo"
                error={errors.marca}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                }
              />

              <FormField
                label="Modelo"
                name="modelo"
                value={form.modelo}
                onChange={(e) => handleInputChange("modelo", e.target.value)}
                placeholder="Ex: R 450, FH 540"
                error={errors.modelo}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                }
              />

              <FormField
                label="Ano"
                name="ano"
                type="number"
                value={form.ano}
                onChange={(e) => handleInputChange("ano", e.target.value)}
                placeholder="Ex: 2020"
                maxLength={4}
                error={errors.ano}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Quantidade de Pneus"
                name="qtd_pneus"
                type="number"
                value={form.qtd_pneus}
                onChange={(e) => handleInputChange("qtd_pneus", e.target.value)}
                required
                placeholder="Ex: 6"
                error={errors.qtd_pneus}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              />

              <FormField
                label="Quilometragem Atual"
                name="km_atual"
                type="number"
                value={form.km_atual}
                onChange={(e) => handleInputChange("km_atual", e.target.value)}
                required
                placeholder="Ex: 150000"
                error={errors.km_atual}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                }
              />
            </div>

            {/* Seção de Carretas */}
            <div className="bg-gray-50 p-6 rounded-xl border border-border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-text-primary">
                  Dados das Carretas
                </h3>
                {carretas.length < 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addCarreta}
                    icon={
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    }
                  >
                    Adicionar Carreta
                  </Button>
                )}
              </div>

              <div className="space-y-6">
                {/* Carreta 1 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Número Carreta 1"
                    name="carreta_0"
                    value={carretas[0]}
                    onChange={(e) => handleCarretaChange(0, e.target.value)}
                    error={errors.carreta_0}
                    placeholder="0-99"
                  />
                  <FormField
                    label="Placa Carreta 1"
                    name="placa_carreta_1"
                    value={form.placa_carreta_1}
                    onChange={(e) =>
                      handleInputChange("placa_carreta_1", e.target.value)
                    }
                    placeholder="ABC1D23"
                    maxLength={7}
                    error={errors.placa_carreta_1}
                  />
                </div>

                {/* Carreta 2 */}
                {carretas.length > 1 && (
                  <div className="relative pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => removeCarreta(1)}
                      className="absolute top-0 right-0 -mt-3 bg-white text-danger p-1 rounded-full border border-gray-200 hover:bg-red-50 transition-colors"
                      title="Remover carreta"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        label="Número Carreta 2"
                        name="carreta_1"
                        value={carretas[1]}
                        onChange={(e) => handleCarretaChange(1, e.target.value)}
                        error={errors.carreta_1}
                        placeholder="0-99"
                      />
                      <FormField
                        label="Placa Carreta 2"
                        name="placa_carreta_2"
                        value={form.placa_carreta_2}
                        onChange={(e) =>
                          handleInputChange("placa_carreta_2", e.target.value)
                        }
                        placeholder="ABC1D23"
                        maxLength={7}
                        error={errors.placa_carreta_2}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate(-1)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                loading={loading}
                icon={
                  !loading && (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )
                }
              >
                Cadastrar Caminhão
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CadastroCaminhao;
