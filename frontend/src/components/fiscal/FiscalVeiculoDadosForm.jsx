import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Button, Card, FormField } from "../ui";
import {
  useFiscalVeiculoDadosQuery,
  useSaveFiscalVeiculoDadosMutation,
} from "../../hooks";
import { parseApiError } from "../../lib/apiClient.js";

// Códigos de tpCarroceria do MDF-e (SEFAZ, grupo veicReboque).
const TIPO_CARROCERIA_OPTIONS = [
  { value: "00", label: "00 — Não aplicável" },
  { value: "01", label: "01 — Aberta" },
  { value: "02", label: "02 — Fechada / Baú" },
  { value: "03", label: "03 — Granelera" },
  { value: "04", label: "04 — Porta Container" },
  { value: "05", label: "05 — Sider" },
];

const emptyForm = {
  rntrc_veiculo: "",
  renavam: "",
  tara_kg: "",
  cap_kg: "",
  cap_m3: "",
  tipo_carroceria: "",
  uf: "",
};

function toForm(dados) {
  if (!dados) return { ...emptyForm };
  return {
    rntrc_veiculo: dados.rntrc_veiculo ?? "",
    renavam: dados.renavam ?? "",
    tara_kg: dados.tara_kg != null ? String(dados.tara_kg) : "",
    cap_kg: dados.cap_kg != null ? String(dados.cap_kg) : "",
    cap_m3: dados.cap_m3 != null ? String(dados.cap_m3) : "",
    tipo_carroceria: dados.tipo_carroceria ?? "",
    uf: dados.uf ?? "",
  };
}

// "" -> undefined (não grava); número -> Number; NaN -> undefined.
function optionalNumber(value) {
  if (value === "" || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Dados fiscais do veículo (extensão de `caminhoes` sem tocar a tabela) usados
 * no grupo veicReboque do MDF-e quando a carreta é acoplada a um cavalo. Sem
 * esta tela, emitir MDF-e para um cavalo com carreta vinculada quebra com 400.
 */
export default function FiscalVeiculoDadosForm({ caminhaoId }) {
  const dadosQuery = useFiscalVeiculoDadosQuery(caminhaoId);
  const salvar = useSaveFiscalVeiculoDadosMutation(caminhaoId);

  const [form, setForm] = useState(emptyForm);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (dadosQuery.isSuccess) setForm(toForm(dadosQuery.data));
  }, [dadosQuery.isSuccess, dadosQuery.data]);

  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setOk(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    setOk(false);
    setFieldErrors({});

    const payload = {
      rntrc_veiculo: form.rntrc_veiculo.trim(),
      renavam: form.renavam.trim(),
      tara_kg: optionalNumber(form.tara_kg),
      cap_kg: optionalNumber(form.cap_kg),
      cap_m3: optionalNumber(form.cap_m3),
      tipo_carroceria: form.tipo_carroceria || undefined,
      uf: form.uf.trim().toUpperCase() || undefined,
    };

    try {
      await salvar.mutateAsync(payload);
      setOk(true);
    } catch (err) {
      const parsed = await parseApiError(err);
      setErro(parsed.message || "Falha ao salvar os dados fiscais do veículo");
      if (parsed.fieldErrors) setFieldErrors(parsed.fieldErrors);
    }
  };

  return (
    <Card className="shadow-lg">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary">
          Dados fiscais do veículo (MDF-e)
        </h2>
        <p className="text-sm text-text-secondary">
          Preenchidos no grupo veicReboque do MDF-e quando esta carreta está
          acoplada a um cavalo. Tara, capacidade de carga e tipo de carroceria
          são exigidos pela SEFAZ na emissão.
        </p>
      </div>

      {dadosQuery.isError && (
        <Alert
          type="error"
          className="mt-4"
          message="Falha ao carregar os dados fiscais do veículo."
        />
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {erro && <Alert type="error" message={erro} />}
        {ok && <Alert type="success" message="Dados fiscais do veículo salvos." />}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label="RNTRC do veículo"
            name="rntrc_veiculo"
            value={form.rntrc_veiculo}
            onChange={(e) =>
              set("rntrc_veiculo", e.target.value.replace(/\D/g, "").slice(0, 9))
            }
            placeholder="Somente números"
            helperText="RNTRC específico deste veículo, se houver."
            error={fieldErrors.rntrc_veiculo}
            className="mb-0"
          />
          <FormField
            label="RENAVAM"
            name="renavam"
            value={form.renavam}
            onChange={(e) =>
              set("renavam", e.target.value.replace(/\D/g, "").slice(0, 20))
            }
            placeholder="Somente números"
            error={fieldErrors.renavam}
            className="mb-0"
          />
          <FormField
            label="Tara (kg)"
            name="tara_kg"
            type="number"
            value={form.tara_kg}
            onChange={(e) => set("tara_kg", e.target.value)}
            placeholder="Ex: 7000"
            error={fieldErrors.tara_kg}
            className="mb-0"
          />
          <FormField
            label="Capacidade de carga (kg)"
            name="cap_kg"
            type="number"
            value={form.cap_kg}
            onChange={(e) => set("cap_kg", e.target.value)}
            placeholder="Ex: 25000"
            error={fieldErrors.cap_kg}
            className="mb-0"
          />
          <FormField
            label="Capacidade volumétrica (m³)"
            name="cap_m3"
            type="number"
            step="0.001"
            value={form.cap_m3}
            onChange={(e) => set("cap_m3", e.target.value)}
            placeholder="Ex: 90"
            error={fieldErrors.cap_m3}
            className="mb-0"
          />
          <FormField
            label="Tipo de carroceria"
            name="tipo_carroceria"
            type="select"
            value={form.tipo_carroceria}
            onChange={(e) => set("tipo_carroceria", e.target.value)}
            options={TIPO_CARROCERIA_OPTIONS}
            allowEmpty
            emptyLabel="Selecione…"
            error={fieldErrors.tipo_carroceria}
            className="mb-0"
          />
          <FormField
            label="UF de licenciamento"
            name="uf"
            value={form.uf}
            onChange={(e) =>
              set(
                "uf",
                e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2),
              )
            }
            placeholder="SP"
            maxLength={2}
            error={fieldErrors.uf}
            className="mb-0"
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            loading={salvar.isPending}
            disabled={dadosQuery.isLoading}
          >
            Salvar dados fiscais
          </Button>
        </div>
      </form>
    </Card>
  );
}

FiscalVeiculoDadosForm.propTypes = {
  caminhaoId: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    .isRequired,
};
