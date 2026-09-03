import React, { useState, useEffect, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useApiMutation, useCaminhaoByPlacaQuery } from "../hooks";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { CardSkeleton } from "../components/Skeleton.jsx";
import {
  Card,
  Button,
  FormField,
  Alert,
  PageHeader,
  SearchableSelect,
} from "../components/ui";
import { TIPO_VEICULO_OPTIONS } from "../utils/caminhaoOptions.js";
import { apiFetch } from "../lib/apiClient.js";
import { useAuth } from "../context/AuthContext.jsx";
import { featureEnabled } from "../utils/billing.js";
import FiscalVeiculoDadosForm from "../components/fiscal/FiscalVeiculoDadosForm.jsx";

const EditCaminhao = () => {
  const { placa } = useParams();
  const navigate = useNavigate();
  const { put } = useApiMutation();
  const { user } = useAuth();
  const fiscalEnabled = featureEnabled(user, "transporte_fiscal");

  const {
    data: caminhaoData,
    isLoading: loading,
    error: queryError,
  } = useCaminhaoByPlacaQuery(placa);

  const [form, setForm] = useState({
    placa: "",
    qtd_pneus: "",
    km_atual: "",
    numero_cavalo: "",
    motorista: "",
    motorista_id: "",
    marca: "",
    modelo: "",
    ano: "",
    placa_carreta_1: "",
    placa_carreta_2: "",
    numero_carreta_1: "",
    numero_carreta_2: "",
    tipo_veiculo: "truck",
    config_eixos: "",
    com_4_eixo: false,
    chassi: "",
    empresa: "",
  });

  const [motoristas, setMotoristas] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const loadError = queryError?.message || "";
  const isCarreta = form.tipo_veiculo === "carreta";
  const podeVincularCarreta =
    form.tipo_veiculo === "cavalo" || form.tipo_veiculo === "truck";

  const motoristaOptions = useMemo(
    () =>
      motoristas.map((m) => ({
        value: String(m.id),
        label: m.nome,
        searchText: `${m.nome} ${m.cpf || ""} ${m.cnh || ""}`,
      })),
    [motoristas],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch({ url: "/motoristas" });
        if (!cancelled) setMotoristas(res.data || []);
      } catch {
        if (!cancelled) setMotoristas([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!caminhaoData) return;

    const data = caminhaoData;
    setForm({
      placa: data.placa || "",
      qtd_pneus: data.qtd_pneus ?? "",
      km_atual: data.km_atual ?? "",
      numero_cavalo:
        data.numero_cavalo != null ? String(data.numero_cavalo) : "",
      motorista: data.motorista || "",
      motorista_id:
        data.motorista_id != null
          ? String(data.motorista_id)
          : data.motorista_ref?.id != null
            ? String(data.motorista_ref.id)
            : "",
      marca: data.marca || "",
      modelo: data.modelo || "",
      ano: data.ano ?? "",
      placa_carreta_1: data.placa_carreta_1 || "",
      placa_carreta_2: data.placa_carreta_2 || "",
      numero_carreta_1:
        data.numero_carreta_1 != null ? String(data.numero_carreta_1) : "",
      numero_carreta_2:
        data.numero_carreta_2 != null ? String(data.numero_carreta_2) : "",
      tipo_veiculo: data.tipo_veiculo || "truck",
      config_eixos: data.config_eixos || "",
      com_4_eixo: Boolean(data.com_4_eixo),
      chassi: data.chassi || "",
      empresa: data.empresa || "",
    });
  }, [caminhaoData, placa]);

  const validateForm = () => {
    const newErrors = {};

    if (!form.qtd_pneus || parseInt(form.qtd_pneus) <= 0) {
      newErrors.qtd_pneus = "Qtd. inválida";
    }

    if (!isCarreta && (!form.km_atual || parseInt(form.km_atual) < 0)) {
      newErrors.km_atual = "KM inválido";
    }

    if (!isCarreta && form.numero_cavalo) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    setFieldErrors({});

    if (!validateForm()) {
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        qtd_pneus: form.qtd_pneus ? parseInt(form.qtd_pneus) : null,
        km_atual: form.km_atual ? parseInt(form.km_atual) : null,
        numero_cavalo:
          !isCarreta && form.numero_cavalo?.trim()
            ? parseInt(form.numero_cavalo, 10)
            : null,
        motorista_id: form.motorista_id ? Number(form.motorista_id) : null,
        motorista:
          motoristas.find((m) => String(m.id) === String(form.motorista_id))
            ?.nome ||
          form.motorista.trim() ||
          null,
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        ano: form.ano ? parseInt(form.ano) : null,
        // Carretas passam a ser vinculadas na ficha (composição); limpa legado se for carreta.
        numero_carreta_1: isCarreta
          ? null
          : form.numero_carreta_1?.trim()
            ? parseInt(form.numero_carreta_1, 10)
            : null,
        placa_carreta_1: isCarreta ? null : form.placa_carreta_1 || null,
        numero_carreta_2: isCarreta
          ? null
          : form.numero_carreta_2?.trim()
            ? parseInt(form.numero_carreta_2, 10)
            : null,
        placa_carreta_2: isCarreta ? null : form.placa_carreta_2 || null,
        tipo_veiculo: form.tipo_veiculo || "truck",
        config_eixos: form.config_eixos?.trim() || null,
        com_4_eixo: Boolean(form.com_4_eixo),
        chassi: form.chassi?.trim() || null,
        empresa: form.empresa?.trim() || null,
      };

      await put(`/caminhoes/${placa}`, payload);
      setTimeout(() => {
        navigate(`/caminhao/${placa}`);
      }, 1500);
    } catch (err) {
      setSubmitError(err.message || "Erro ao atualizar caminhão");
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageLayout narrow className="space-y-6">
        <CardSkeleton />
      </PageLayout>
    );
  }

  if (loadError) {
    return (
      <PageLayout narrow className="space-y-4">
        <Alert
          type="error"
          title="Caminhão não encontrado"
          message={loadError}
        />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Voltar
          </Button>
          <Button onClick={() => navigate("/")}>Ir para início</Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout narrow className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/" },
          { label: placa, to: `/caminhao/${placa}` },
          { label: "Editar" },
        ]}
      />
      <PageHeader
        title={`Editar caminhão: ${placa}`}
        subtitle="Atualize os dados do veículo"
      />

      <Card className="shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {submitError && (
              <Alert type="error" message={submitError} />
            )}
            <FormField
              label="Tipo do veículo"
              name="tipo_veiculo"
              type="typeahead"
              value={form.tipo_veiculo}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  tipo_veiculo: e.target.value || "truck",
                }))
              }
              options={TIPO_VEICULO_OPTIONS}
              required
              placeholder="Digite: truck, cavalo ou carreta..."
              helperText={
                isCarreta
                  ? "Este cadastro é a própria carreta. Não informe carretas acopladas aqui."
                  : "Para acoplar carreta(s), use a composição na ficha do veículo após salvar."
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                label="Config. eixos"
                value={form.config_eixos}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, config_eixos: e.target.value }))
                }
                placeholder="6x2, 6x4..."
              />
              <FormField
                label="Chassi"
                value={form.chassi}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, chassi: e.target.value }))
                }
              />
              <FormField
                label="Empresa"
                value={form.empresa}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, empresa: e.target.value }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.com_4_eixo}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    com_4_eixo: e.target.checked,
                  }))
                }
              />
              Possui 4º eixo
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Placa do Veículo"
                name="placa"
                value={form.placa}
                disabled
                className="bg-gray-100"
                helperText="A placa não pode ser alterada"
              />

              {!isCarreta && (
                <FormField
                  label="Número do Cavalo"
                  name="numero_cavalo"
                  type="number"
                  value={form.numero_cavalo}
                  onChange={(e) =>
                    handleInputChange("numero_cavalo", e.target.value)
                  }
                  placeholder="Opcional"
                  helperText="Deixe em branco se o cavalo ainda não foi numerado."
                  error={errors.numero_cavalo || fieldErrors.numero_cavalo}
                />
              )}
            </div>

            {!isCarreta && (
              <div className="space-y-3">
                <SearchableSelect
                  label="Motorista"
                  name="motorista_id"
                  value={form.motorista_id}
                  onChange={(id) => {
                    const selected = motoristas.find(
                      (m) => String(m.id) === String(id),
                    );
                    setForm((prev) => ({
                      ...prev,
                      motorista_id: id,
                      motorista: selected?.nome || "",
                    }));
                  }}
                  options={motoristaOptions}
                  allowEmpty
                  emptyLabel="Nenhum motorista"
                  placeholder="Buscar motorista cadastrado..."
                  error={errors.motorista_id || fieldErrors.motorista_id}
                  helperText="Vincule um cadastro da tela Motoristas."
                />
                <p className="text-sm text-text-secondary -mt-2">
                  Gerencie em{" "}
                  <Link to="/motoristas" className="text-secondary underline">
                    Motoristas
                  </Link>
                  .
                </p>
                {!form.motorista_id && (
                  <FormField
                    label="Nome do motorista (texto)"
                    name="motorista"
                    value={form.motorista}
                    onChange={(e) =>
                      handleInputChange("motorista", e.target.value)
                    }
                    placeholder="Nome completo (legado, se sem vínculo)"
                    error={errors.motorista || fieldErrors.motorista}
                  />
                )}
              </div>
            )}

            {/* Dados do Veículo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                label="Marca"
                name="marca"
                value={form.marca}
                onChange={(e) => handleInputChange("marca", e.target.value)}
                placeholder="Ex: Scania, Volvo"
                error={errors.marca || fieldErrors.marca}
              />

              <FormField
                label="Modelo"
                name="modelo"
                value={form.modelo}
                onChange={(e) => handleInputChange("modelo", e.target.value)}
                placeholder="Ex: R 450, FH 540"
                error={errors.modelo || fieldErrors.modelo}
              />

              <FormField
                label="Ano"
                name="ano"
                type="number"
                value={form.ano}
                onChange={(e) => handleInputChange("ano", e.target.value)}
                placeholder="Ex: 2020"
                maxLength={4}
                error={errors.ano || fieldErrors.ano}
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
                placeholder={isCarreta ? "Ex: 12" : "Ex: 6"}
                error={errors.qtd_pneus || fieldErrors.qtd_pneus}
              />

              <FormField
                label="Quilometragem Atual"
                name="km_atual"
                type="number"
                value={form.km_atual}
                onChange={(e) => handleInputChange("km_atual", e.target.value)}
                required={!isCarreta}
                placeholder="Ex: 150000"
                error={errors.km_atual || fieldErrors.km_atual}
              />
            </div>

            {podeVincularCarreta && (
              <Alert
                type="info"
                title="Composição (cavalo + carreta)"
                message={
                  <span>
                    Cadastre a carreta como veículo do tipo{" "}
                    <strong>Carreta</strong> e vincule na ficha deste veículo.
                    A troca fica opcional e não fixa no cadastro.{" "}
                    <Link
                      to={`/caminhao/${placa}`}
                      className="font-medium text-secondary underline underline-offset-2"
                    >
                      Abrir ficha para vincular
                    </Link>
                  </span>
                }
              />
            )}

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

        {isCarreta && fiscalEnabled && caminhaoData?.id && (
          <FiscalVeiculoDadosForm caminhaoId={caminhaoData.id} />
        )}
    </PageLayout>
  );
};

export default EditCaminhao;
