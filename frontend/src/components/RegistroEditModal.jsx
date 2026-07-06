import React, { useEffect, useState } from "react";
import Modal from "./ui/Modal.jsx";
import { Button, FormField } from "./ui";
import { useApiMutation } from "../hooks";
import { apiFetch } from "../lib/apiClient.js";
import { isCombustivelTipo } from "../utils/tipoGastoUtils.js";

export default function RegistroEditModal({
  registro,
  tiposGastos,
  itensChecklist,
  caminhoes,
  onClose,
  onSaved,
}) {
  const { put } = useApiMutation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  const isManutencao = registro?.tipo_registro === "Manutenção";

  useEffect(() => {
    if (!registro?.id) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const url = isManutencao
          ? `/checklist/${registro.id}`
          : `/gastos/${registro.id}`;
        const res = await apiFetch({ method: "GET", url });
        const data = res.data;
        if (cancelled) return;

        if (isManutencao) {
          setForm({
            caminhao_id: data.caminhao_id || "",
            item_id: data.item_id || "",
            data_manutencao: data.data_manutencao
              ? new Date(data.data_manutencao).toISOString().split("T")[0]
              : "",
            observacao: data.observacao || "",
            valor: data.valor || "",
            oficina: data.oficina || "",
            km_manutencao: data.km_manutencao || "",
          });
        } else {
          setForm({
            caminhao_id: data.caminhao_id || "",
            tipo_gasto_id: data.tipo_gasto_id || "",
            valor: data.valor || "",
            data_gasto: data.data_gasto
              ? new Date(data.data_gasto).toISOString().split("T")[0]
              : "",
            descricao: data.descricao || "",
            km_registro: data.km_registro || "",
            quantidade_combustivel: data.quantidade_combustivel || "",
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
            ...form,
            caminhao_id: Number(form.caminhao_id),
            item_id: Number(form.item_id),
            valor: parseFloat(String(form.valor).replace(",", ".")),
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
            ...form,
            caminhao_id: Number(form.caminhao_id),
            tipo_gasto_id: Number(form.tipo_gasto_id),
            valor: parseFloat(String(form.valor).replace(",", ".")),
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
      {loading || !form ? (
        <p className="text-sm text-text-secondary">Carregando...</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <FormField
            label="Caminhão"
            name="caminhao_id"
            as="select"
            value={form.caminhao_id}
            onChange={handleChange}
            required
          >
            <option value="">Selecione</option>
            {caminhoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.placa}
              </option>
            ))}
          </FormField>

          {isManutencao ? (
            <>
              <FormField
                label="Item de manutenção"
                name="item_id"
                as="select"
                value={form.item_id}
                onChange={handleChange}
                required
              >
                <option value="">Selecione</option>
                {itensChecklist.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome_item}
                  </option>
                ))}
              </FormField>
              <FormField
                label="Data"
                name="data_manutencao"
                type="date"
                value={form.data_manutencao}
                onChange={handleChange}
                required
              />
              <FormField
                label="Valor (R$)"
                name="valor"
                value={form.valor}
                onChange={handleChange}
                required
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
                as="textarea"
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
                as="select"
                value={form.tipo_gasto_id}
                onChange={handleChange}
                required
              >
                <option value="">Selecione</option>
                {tiposGastos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome_tipo}
                  </option>
                ))}
              </FormField>
              <FormField
                label="Data"
                name="data_gasto"
                type="date"
                value={form.data_gasto}
                onChange={handleChange}
                required
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
                tiposGastos.find((t) => t.id === Number(form.tipo_gasto_id)),
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
                as="textarea"
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
            <Button type="submit" loading={saving}>
              Salvar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
