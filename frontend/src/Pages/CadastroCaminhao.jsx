import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApiMutation } from "../hooks";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import {
  Card,
  Button,
  FormField,
  PageHeader,
  Alert,
  SearchableSelect,
} from "../components/ui";
import { TIPO_VEICULO_OPTIONS } from "../utils/caminhaoOptions.js";
import { FIELD_LIMITS } from "../utils/fieldLimits.js";
import {
  maskDigitsInput,
  maskPersonNameInput,
} from "../utils/inputMasks.js";
import { apiFetch } from "../lib/apiClient.js";

const CadastroCaminhao = () => {
  const navigate = useNavigate();
  const { post } = useApiMutation();

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
    tipo_veiculo: "truck",
    config_eixos: "",
    com_4_eixo: false,
    chassi: "",
    empresa: "",
  });

  const [motoristas, setMotoristas] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

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

    if (!form.qtd_pneus || parseInt(form.qtd_pneus) <= 0) {
      newErrors.qtd_pneus = "Qtd. inválida";
    }

    if (!isCarreta && (!form.km_atual || parseInt(form.km_atual) < 0)) {
      newErrors.km_atual = "KM inválido";
    }

    if (form.numero_cavalo && form.numero_cavalo.trim() !== "") {
      const numeroCavalo = parseInt(form.numero_cavalo);
      if (isNaN(numeroCavalo) || numeroCavalo < 0) {
        newErrors.numero_cavalo = "Deve ser positivo";
      } else if (numeroCavalo > 9999) {
        newErrors.numero_cavalo = "Máximo 9999";
      }
    }

    if (!isCarreta) {
      const hasId = Boolean(form.motorista_id);
      const hasName = form.motorista.trim().length >= 3;
      if (!hasId && !hasName) {
        newErrors.motorista_id =
          motoristas.length > 0
            ? "Selecione um motorista cadastrado"
            : "Cadastre um motorista ou informe o nome (mín. 3 caracteres)";
        if (
          !motoristas.length &&
          form.motorista.trim() &&
          form.motorista.trim().length < 3
        ) {
          newErrors.motorista = "Mínimo 3 caracteres";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    let formattedValue = value;

    if (field === "motorista") {
      formattedValue = maskPersonNameInput(value, FIELD_LIMITS.MOTORISTA_TEXTO);
    } else if (field === "ano") {
      formattedValue = maskDigitsInput(value, 4);
    } else if (["qtd_pneus", "km_atual", "numero_cavalo"].includes(field)) {
      formattedValue = maskDigitsInput(value, 8);
    }

    setForm((prev) => ({ ...prev, [field]: formattedValue }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      const selected = motoristas.find(
        (m) => String(m.id) === String(form.motorista_id),
      );
      const payload = {
        placa: form.placa.replace(/-/g, ""),
        qtd_pneus: parseInt(form.qtd_pneus),
        km_atual: form.km_atual ? parseInt(form.km_atual) : 0,
        numero_cavalo: form.numero_cavalo?.trim()
          ? parseInt(form.numero_cavalo, 10)
          : null,
        motorista_id: form.motorista_id ? Number(form.motorista_id) : null,
        motorista: selected?.nome || form.motorista.trim() || null,
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        ano: form.ano ? parseInt(form.ano) : null,
        tipo_veiculo: form.tipo_veiculo,
        config_eixos: form.config_eixos.trim() || null,
        com_4_eixo: Boolean(form.com_4_eixo),
        chassi: form.chassi.trim() || null,
        empresa: form.empresa.trim() || null,
      };

      await post("/caminhoes", payload);
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout narrow className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/" },
          { label: "Novo caminhão" },
        ]}
      />
      <PageHeader
        title="Cadastrar veículo"
        subtitle="Truck, cavalo ou carreta — cada placa é um cadastro próprio"
      />

      <Card className="shadow-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
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
                ? "Cadastre a carreta com a placa dela. Depois vincule no cavalo/truck pela ficha do veículo."
                : "Após salvar, abra a ficha do veículo para vincular carreta(s) cadastradas — a troca não fica fixa."
            }
          />

          {podeVincularCarreta && (
            <Alert
              type="info"
              message="Cadastre cada carreta como tipo «Carreta». Na ficha deste cavalo/truck você faz o vínculo (composição)."
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Placa"
              name="placa"
              value={form.placa}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, placa: e.target.value }))
              }
              required
              placeholder="ABC1D23"
              mask="placa"
              error={errors.placa || fieldErrors.placa}
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
                min={0}
                max={FIELD_LIMITS.NUMERO_CAVALO_MAX}
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
                  if (errors.motorista_id) {
                    setErrors((prev) => ({ ...prev, motorista_id: "" }));
                  }
                }}
                options={motoristaOptions}
                required={motoristas.length > 0}
                allowEmpty
                emptyLabel="Nenhum motorista"
                placeholder="Buscar motorista cadastrado..."
                error={errors.motorista_id || fieldErrors.motorista_id}
                helperText="Preferencial: vincule um cadastro da tela Motoristas."
              />
              <p className="text-sm text-text-secondary -mt-2">
                Gerencie cadastros em{" "}
                <Link to="/motoristas" className="text-secondary underline">
                  Motoristas
                </Link>
                .
              </p>
              {motoristas.length === 0 && (
                <FormField
                  label="Nome do motorista (texto)"
                  name="motorista"
                  value={form.motorista}
                  onChange={(e) =>
                    handleInputChange("motorista", e.target.value)
                  }
                  required
                  placeholder="Nome completo"
                  maxLength={FIELD_LIMITS.MOTORISTA_TEXTO}
                  error={errors.motorista || fieldErrors.motorista}
                  helperText="Nenhum motorista cadastrado ainda — use o texto ou cadastre em Motoristas."
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
              label="Marca"
              name="marca"
              value={form.marca}
              onChange={(e) => handleInputChange("marca", e.target.value)}
              placeholder="Ex: Volvo, Iveco"
              maxLength={FIELD_LIMITS.MARCA}
            />
            <FormField
              label="Modelo"
              name="modelo"
              value={form.modelo}
              onChange={(e) => handleInputChange("modelo", e.target.value)}
              placeholder="Ex: FH 460 6x2T"
              maxLength={FIELD_LIMITS.MODELO}
            />
            <FormField
              label="Ano"
              name="ano"
              type="number"
              value={form.ano}
              onChange={(e) => handleInputChange("ano", e.target.value)}
              placeholder="Ex: 2020"
              min={FIELD_LIMITS.ANO_MIN}
              max={FIELD_LIMITS.ANO_MAX}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField
              label="Config. eixos"
              name="config_eixos"
              value={form.config_eixos}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, config_eixos: e.target.value }))
              }
              placeholder="Ex: 6x2, 6x4, 8x2"
              maxLength={FIELD_LIMITS.CONFIG_EIXOS}
            />
            <FormField
              label="Chassi"
              name="chassi"
              value={form.chassi}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, chassi: e.target.value }))
              }
              placeholder="Opcional"
              mask="chassi"
            />
            <FormField
              label="Empresa / frota"
              name="empresa"
              value={form.empresa}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, empresa: e.target.value }))
              }
              placeholder="Ex: Solofino, Colombocal"
              maxLength={FIELD_LIMITS.EMPRESA}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-primary">
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
              label="Quantidade de Pneus"
              name="qtd_pneus"
              type="number"
              value={form.qtd_pneus}
              onChange={(e) => handleInputChange("qtd_pneus", e.target.value)}
              required
              placeholder={isCarreta ? "Ex: 12" : "Ex: 6"}
              min={1}
              max={30}
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
              min={0}
              max={FIELD_LIMITS.KM_MAX}
              error={errors.km_atual || fieldErrors.km_atual}
            />
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
            >
              Cadastrar veículo
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
};

export default CadastroCaminhao;
