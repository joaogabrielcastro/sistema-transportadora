import React, { useEffect, useState } from "react";
import Modal from "./ui/Modal.jsx";
import { Button, FormField } from "./ui";
import { useApiMutation } from "../hooks";
import { apiFetch } from "../lib/apiClient.js";
import { isCombustivelTipo } from "../utils/tipoGastoUtils.js";

/** Converte DATE da API para yyyy-MM-dd sem deslocar fuso. */
function toInputDate(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function displayValue(value) {
  if (value === null || value === undefined || value === "N/A") return "";
  return String(value);
}

function buildInitialForm(registro, isManutencao) {
  if (!registro) return null;

  if (isManutencao) {
    return {
      caminhao_id:
        registro.caminhao_id != null ? String(registro.caminhao_id) : "",
      placa: registro.placa || registro.caminhoes?.placa || "",
      nome_item: registro.nome_tipo || registro.itens_checklist?.nome_item || "",
      data_manutencao: toInputDate(registro.data || registro.data_manutencao),
      observacao: displayValue(registro.observacao),
      valor: displayValue(registro.valor),
      oficina:
        registro.oficina && registro.oficina !== "N/A" ? registro.oficina : "",
      km_manutencao: displayValue(
        registro.km_manutencao ?? registro.km_registro,
      ),
    };
  }

  return {
    caminhao_id:
      registro.caminhao_id != null ? String(registro.caminhao_id) : "",
    placa: registro.placa || registro.caminhoes?.placa || "",
    tipo_gasto_id:
      registro.tipo_gasto_id != null ? String(registro.tipo_gasto_id) : "",
    valor: displayValue(registro.valor),
    data_gasto: toInputDate(registro.data || registro.data_gasto),
    descricao: displayValue(registro.descricao || registro.observacao),
    km_registro: displayValue(registro.km_registro),
    quantidade_combustivel: displayValue(registro.quantidade_combustivel),
  };
}

export default function RegistroEditModal({
  registro,
  tiposGastos = [],
  onClose,
  onSaved,
}) {
  const { put } = useApiMutation();
  const isManutencao = registro?.tipo_registro === "Manutenção";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() =>
    buildInitialForm(registro, isManutencao),
  );

  useEffect(() => {
    if (!registro?.id) return;

    setForm(buildInitialForm(registro, isManutencao));

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const url = isManutencao
          ? `/checklist/${registro.id}`
          : `/gastos/${registro.id}`;
        const res = await apiFetch({ method: "GET", url });
        const data = res.data;
        if (cancelled || !data) return;

        if (isManutencao) {
          setForm({
            caminhao_id:
              data.caminhao_id != null ? String(data.caminhao_id) : "",
            placa: data.caminhoes?.placa || registro.placa || "",
            nome_item: data.itens_checklist?.nome_item || "",
            data_manutencao: toInputDate(data.data_manutencao),
            observacao: displayValue(data.observacao),
            valor: displayValue(data.valor),
            oficina: displayValue(data.oficina),
            km_manutencao: displayValue(data.km_manutencao),
          });
        } else {
          setForm({
            caminhao_id:
              data.caminhao_id != null ? String(data.caminhao_id) : "",
            placa: data.caminhoes?.placa || registro.placa || "",
            tipo_gasto_id:
              data.tipo_gasto_id != null ? String(data.tipo_gasto_id) : "",
            valor: displayValue(data.valor),
            data_gasto: toInputDate(data.data_gasto),
            descricao: displayValue(data.descricao),
            km_registro: displayValue(data.km_registro),
            quantidade_combustivel: displayValue(data.quantidade_combustivel),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [registro, isManutencao]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);

    try {
      if (isManutencao) {
        await put(
          `/checklist/${registro.id}`,
          {
            caminhao_id: Number(form.caminhao_id),
            nome_item: String(form.nome_item || "").trim(),
            data_manutencao: form.data_manutencao,
            observacao: form.observacao || null,
            valor: form.valor
              ? parseFloat(String(form.valor).replace(",", "."))
              : null,
            oficina: form.oficina || null,
            km_manutencao: form.km_manutencao
              ? parseInt(form.km_manutencao, 10)
              : null,
          },
          { skipSuccessToast: true },
        );
      } else {
        const tipo = tiposGastos.find(
          (t) => t.id === Number(form.tipo_gasto_id),
        );
        await put(
          `/gastos/${registro.id}`,
          {
            caminhao_id: Number(form.caminhao_id),
            tipo_gasto_id: Number(form.tipo_gasto_id),
            valor: parseFloat(String(form.valor).replace(",", ".")),
            data_gasto: form.data_gasto,
            descricao: form.descricao || null,
            km_registro: form.km_registro
              ? parseInt(form.km_registro, 10)
              : null,
            quantidade_combustivel: isCombustivelTipo(tipo)
              ? parseFloat(String(form.quantidade_combustivel).replace(",", "."))
              : null,
          },
          { skipSuccessToast: true },
        );
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(registro)}
      onClose={onClose}
      title={isManutencao ? "Editar manutenção" : "Editar gasto"}
      size="lg"
    >
      {!form ? (
        <p className="text-sm text-text-secondary">Carregando...</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <FormField
            label="Caminhão"
            name="placa"
            type="text"
            value={form.placa || "—"}
            disabled
            helperText="O caminhão do registro não pode ser alterado aqui."
          />

          {isManutencao ? (
            <>
              <FormField
                label="Item de manutenção"
                name="nome_item"
                type="text"
                value={form.nome_item}
                onChange={handleChange}
                required
                placeholder="Ex.: Troca de óleo, filtros, pastilhas..."
              />
              <FormField
                label="Data"
                name="data_manutencao"
                type="date"
                value={form.data_manutencao}
                onChange={handleChange}
                required
                max={new Date().toISOString().split("T")[0]}
              />
              <FormField
                label="Valor (R$)"
                name="valor"
                value={form.valor}
                onChange={handleChange}
              />
              <FormField
                label="Oficina"
                name="oficina"
                value={form.oficina}
                onChange={handleChange}
              />
              <FormField
                label="KM"
                name="km_manutencao"
                value={form.km_manutencao}
                onChange={handleChange}
              />
              <FormField
                label="Observação"
                name="observacao"
                type="textarea"
                rows={2}
                value={form.observacao}
                onChange={handleChange}
              />
            </>
          ) : (
            <>
              <FormField
                label="Tipo de gasto"
                name="tipo_gasto_id"
                type="select"
                value={form.tipo_gasto_id}
                onChange={handleChange}
                required
                options={(tiposGastos || []).map((t) => ({
                  value: String(t.id),
                  label: t.nome_tipo,
                }))}
              />
              <FormField
                label="Data"
                name="data_gasto"
                type="date"
                value={form.data_gasto}
                onChange={handleChange}
                required
                max={new Date().toISOString().split("T")[0]}
              />
              <FormField
                label="Valor (R$)"
                name="valor"
                value={form.valor}
                onChange={handleChange}
                required
              />
              <FormField
                label="KM"
                name="km_registro"
                value={form.km_registro}
                onChange={handleChange}
              />
              {isCombustivelTipo(
                tiposGastos.find((t) => String(t.id) === String(form.tipo_gasto_id)),
              ) && (
                <FormField
                  label="Quantidade combustível (L)"
                  name="quantidade_combustivel"
                  value={form.quantidade_combustivel}
                  onChange={handleChange}
                />
              )}
              <FormField
                label="Descrição"
                name="descricao"
                type="textarea"
                rows={2}
                value={form.descricao}
                onChange={handleChange}
              />
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} disabled={loading}>
              Salvar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
