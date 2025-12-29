import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import {
  Card,
  Button,
  FormField,
  Alert,
  LoadingSpinner,
} from "../components/ui";

const EditCaminhao = () => {
  const { placa } = useParams();
  const navigate = useNavigate();
  const { get, put } = useApi();

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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCaminhao = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await get(`/caminhoes/${placa}`);
        const data = response.data || response;

        setForm({
          placa: data.placa || "",
          qtd_pneus: data.qtd_pneus || "",
          km_atual: data.km_atual || "",
          numero_cavalo: data.numero_cavalo || "",
          motorista: data.motorista || "",
          marca: data.marca || "",
          modelo: data.modelo || "",
          ano: data.ano || "",
          placa_carreta_1: data.placa_carreta_1 || "",
          placa_carreta_2: data.placa_carreta_2 || "",
        });

        const carretasArray = [];
        if (data.numero_carreta_1)
          carretasArray.push(String(data.numero_carreta_1));
        if (data.numero_carreta_2)
          carretasArray.push(String(data.numero_carreta_2));

        setCarretas(carretasArray.length > 0 ? carretasArray : [""]);
      } catch (err) {
        console.error("Erro ao carregar:", err);
        setError("Erro ao carregar dados do caminhão.");
      } finally {
        setLoading(false);
      }
    };
    fetchCaminhao();
  }, [placa]);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess("");
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const validateForm = () => {
    const newErrors = {};

    if (!form.qtd_pneus || parseInt(form.qtd_pneus) <= 0) {
      newErrors.qtd_pneus = "Qtd. inválida";
    }

    if (!form.km_atual || parseInt(form.km_atual) < 0) {
      newErrors.km_atual = "KM inválido";
    }

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

    if (form.numero_cavalo) {
      const numeroCavalo = parseInt(form.numero_cavalo);
      if (isNaN(numeroCavalo) || numeroCavalo < 0) {
        newErrors.numero_cavalo = "Deve ser positivo";
      } else if (numeroCavalo > 9999) {
        newErrors.numero_cavalo = "Máximo 9999";
      }
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
    } else if (["qtd_pneus", "km_atual", "numero_cavalo", "ano"].includes(field)) {
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
    setSubmitting(true);
    setError("");

    if (!validateForm()) {
      setSubmitting(false);
      return;
    }

    try {
      const carretasPreenchidas = carretas.filter((c) => c.trim() !== "");

      const payload = {
        qtd_pneus: form.qtd_pneus ? parseInt(form.qtd_pneus) : null,
        km_atual: form.km_atual ? parseInt(form.km_atual) : null,
        numero_cavalo: form.numero_cavalo ? parseInt(form.numero_cavalo) : null,
        motorista: form.motorista.trim() || null,
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        ano: form.ano ? parseInt(form.ano) : null,
        numero_carreta_1: carretasPreenchidas[0]
          ? parseInt(carretasPreenchidas[0])
          : null,
        placa_carreta_1: form.placa_carreta_1 || null,
        numero_carreta_2: carretasPreenchidas[1]
          ? parseInt(carretasPreenchidas[1])
          : null,
        placa_carreta_2: form.placa_carreta_2 || null,
      };

      await put(`/caminhoes/${placa}`, payload);
      setSuccess("Caminhão atualizado com sucesso!");

      setTimeout(() => {
        navigate(`/caminhao/${placa}`);
      }, 1500);
    } catch (err) {
      console.error("Erro ao atualizar:", err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Erro ao atualizar caminhão";
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 md:px-8 flex justify-center">
      <div className="w-full max-w-2xl animate-fade-in">
        <Card
          title={`Editar Caminhão: ${placa}`}
          subtitle="Atualize os dados do veículo"
          className="shadow-lg"
        >
          {success && (
            <Alert type="success" message={success} className="mb-6" />
          )}
          {error && <Alert type="error" message={error} className="mb-6" />}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Placa do Veículo"
                name="placa"
                value={form.placa}
                disabled
                className="bg-gray-100"
                helpText="A placa não pode ser alterada"
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
              />
            </div>

            <FormField
              label="Nome do Motorista"
              name="motorista"
              value={form.motorista}
              onChange={(e) => handleInputChange("motorista", e.target.value)}
              placeholder="Nome completo"
              error={errors.motorista}
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
              />

              <FormField
                label="Modelo"
                name="modelo"
                value={form.modelo}
                onChange={(e) => handleInputChange("modelo", e.target.value)}
                placeholder="Ex: R 450, FH 540"
                error={errors.modelo}
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

            <Alert
              type="info"
              message="Atenção: Atualize o KM sempre que houver manutenção."
              className="text-sm"
            />

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate(`/caminhao/${placa}`)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                loading={submitting}
                icon={
                  !submitting && (
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
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default EditCaminhao;
