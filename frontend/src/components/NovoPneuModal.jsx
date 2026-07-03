import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useApiMutation } from "../hooks";
import { Modal, Button, FormField, Alert } from "./ui";
import PneuPositionPicker from "./pneus/PneuPositionPicker.jsx";
import { isPosicaoAllowedForCaminhao } from "../utils/pneuPosicaoMap.js";

const NovoPneuModal = ({
  isOpen,
  onClose,
  onSuccess,
  caminhoes = [],
  posicoes = [],
  statusOptions = [],
  stockPneus = [],
  defaultCaminhaoId = "",
}) => {
  const { post } = useApiMutation();
  const [modo, setModo] = useState(stockPneus.length > 0 ? "estoque" : "novo");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const [form, setForm] = useState({
    caminhao_id: "",
    posicao_id: "",
    stock_pneu_id: "",
    marca: "",
    modelo: "",
    codigo: "",
    km_instalacao: "",
    vida_util_km: "",
    status_id: "",
    observacao: "",
    data_instalacao: new Date().toISOString().split("T")[0],
  });

  const caminhaoSelecionado = useMemo(
    () => caminhoes.find((c) => String(c.id) === String(form.caminhao_id)),
    [caminhoes, form.caminhao_id],
  );

  useEffect(() => {
    if (!isOpen) return;
    const statusNovo =
      statusOptions.find((s) => /novo|em uso/i.test(s.nome_status || "")) ||
      statusOptions[0];

    setForm({
      caminhao_id: defaultCaminhaoId ? String(defaultCaminhaoId) : "",
      posicao_id: "",
      stock_pneu_id: "",
      marca: "",
      modelo: "",
      codigo: "",
      km_instalacao: "",
      vida_util_km: "",
      status_id: statusNovo ? String(statusNovo.id) : "",
      observacao: "",
      data_instalacao: new Date().toISOString().split("T")[0],
    });
    setModo(stockPneus.length > 0 ? "estoque" : "novo");
    setError("");
    setFieldErrors({});
  }, [isOpen, defaultCaminhaoId, statusOptions, stockPneus.length]);

  useEffect(() => {
    if (caminhaoSelecionado?.km_atual != null && !form.km_instalacao) {
      setForm((prev) => ({
        ...prev,
        km_instalacao: String(caminhaoSelecionado.km_atual),
      }));
    }
  }, [caminhaoSelecionado, form.km_instalacao]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "caminhao_id") {
        const nextCaminhao = caminhoes.find((c) => String(c.id) === String(value));
        if (
          prev.posicao_id &&
          !isPosicaoAllowedForCaminhao(prev.posicao_id, posicoes, nextCaminhao)
        ) {
          next.posicao_id = "";
        }
      }

      return next;
    });
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleStockSelect = (e) => {
    const id = e.target.value;
    const pneu = stockPneus.find((p) => String(p.id) === id);
    setForm((prev) => ({
      ...prev,
      stock_pneu_id: id,
      marca: pneu?.marca || prev.marca,
      modelo: pneu?.modelo || prev.modelo,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({});

    const errors = {};
    if (!form.caminhao_id) errors.caminhao_id = "Selecione o caminhão.";
    if (!form.posicao_id) errors.posicao_id = "Selecione a posição no veículo.";
    if (!form.status_id) errors.status_id = "Selecione o status.";
    if (modo === "estoque" && !form.stock_pneu_id) {
      errors.stock_pneu_id = "Selecione um pneu do estoque.";
    }
    if (modo === "novo") {
      if (!form.marca?.trim()) errors.marca = "Informe a marca.";
      if (!form.modelo?.trim()) errors.modelo = "Informe o modelo.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitting(false);
      return;
    }

    const observacao = [form.codigo?.trim(), form.observacao?.trim()]
      .filter(Boolean)
      .join(" — ");

    const payload = {
      caminhao_id: parseInt(form.caminhao_id, 10),
      posicao_id: parseInt(form.posicao_id, 10),
      status_id: parseInt(form.status_id, 10),
      data_instalacao: form.data_instalacao,
      km_instalacao: form.km_instalacao
        ? parseInt(form.km_instalacao, 10)
        : null,
      vida_util_km: form.vida_util_km
        ? parseInt(form.vida_util_km, 10)
        : null,
      observacao: observacao || null,
    };

    if (modo === "novo") {
      payload.marca = form.marca.trim();
      payload.modelo = form.modelo.trim();
    }

    try {
      if (modo === "estoque") {
        await post("/pneus", {
          ...payload,
          stock_pneu_id: parseInt(form.stock_pneu_id, 10),
        });
      } else {
        await post("/pneus", {
          ...payload,
          consume_from_stock: true,
        });
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      if (err?.fieldErrors) setFieldErrors(err.fieldErrors);
      setError(err?.message || "Não foi possível cadastrar o pneu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Pneu" size="xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert type="error" message={error} dismissible onClose={() => setError("")} />}

        {stockPneus.length > 0 && (
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setModo("estoque")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                modo === "estoque"
                  ? "bg-white shadow text-text-primary"
                  : "text-text-secondary"
              }`}
            >
              Do estoque
            </button>
            <button
              type="button"
              onClick={() => setModo("novo")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                modo === "novo"
                  ? "bg-white shadow text-text-primary"
                  : "text-text-secondary"
              }`}
            >
              Cadastro novo
            </button>
          </div>
        )}

        <FormField
          label="Caminhão"
          name="caminhao_id"
          type="select"
          value={form.caminhao_id}
          onChange={handleChange}
          required
          error={fieldErrors.caminhao_id}
          disabled={Boolean(defaultCaminhaoId)}
          options={caminhoes.map((c) => ({
            value: String(c.id),
            label: `${c.placa}${c.modelo ? ` — ${c.modelo}` : ""}${c.marca ? ` (${c.marca})` : ""}`,
          }))}
        />

        {caminhaoSelecionado && (
          <div className="rounded-lg border border-secondary/20 bg-secondary/5 px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary mb-1">
              Veículo selecionado
            </p>
            <p className="font-bold text-text-primary">{caminhaoSelecionado.placa}</p>
            <p className="text-text-secondary">
              {[caminhaoSelecionado.marca, caminhaoSelecionado.modelo]
                .filter(Boolean)
                .join(" ") || "Modelo não informado"}
            </p>
            <p className="text-xs text-text-light mt-1">
              {caminhaoSelecionado.qtd_pneus
                ? `${caminhaoSelecionado.qtd_pneus} pneus`
                : "Qtd. de pneus não informada"}
              {caminhaoSelecionado.placa_carreta_1
                ? ` • Carreta ${caminhaoSelecionado.placa_carreta_1}`
                : ""}
              {caminhaoSelecionado.placa_carreta_2
                ? ` • Carreta ${caminhaoSelecionado.placa_carreta_2}`
                : ""}
            </p>
            <p className="text-xs text-text-light mt-1">
              Toque nos pneus do desenho para escolher a posição.
            </p>
          </div>
        )}

        {modo === "estoque" && stockPneus.length > 0 && (
          <FormField
            label="Pneu do estoque"
            name="stock_pneu_id"
            type="select"
            value={form.stock_pneu_id}
            onChange={handleStockSelect}
            required
            error={fieldErrors.stock_pneu_id}
            options={stockPneus.map((p) => ({
              value: String(p.id),
              label: `${p.marca} ${p.modelo}`.trim(),
            }))}
          />
        )}

        <PneuPositionPicker
          posicoes={posicoes}
          caminhao={caminhaoSelecionado}
          value={form.posicao_id}
          onChange={(id) =>
            setForm((prev) => ({ ...prev, posicao_id: id }))
          }
          error={fieldErrors.posicao_id}
        />

        {modo === "novo" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Código / Nº série"
              name="codigo"
              value={form.codigo}
              onChange={handleChange}
              placeholder="Ex: PNE-001"
            />
            <FormField
              label="Marca"
              name="marca"
              value={form.marca}
              onChange={handleChange}
              required
              error={fieldErrors.marca}
            />
            <FormField
              label="Modelo"
              name="modelo"
              value={form.modelo}
              onChange={handleChange}
              required
              error={fieldErrors.modelo}
            />
            <FormField
              label="KM já rodados no pneu"
              name="km_instalacao"
              type="number"
              value={form.km_instalacao}
              onChange={handleChange}
              helperText="KM do caminhão no momento da instalação."
            />
            <FormField
              label="Vida útil (km) — opcional"
              name="vida_util_km"
              type="number"
              value={form.vida_util_km}
              onChange={handleChange}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Status"
            name="status_id"
            type="select"
            value={form.status_id}
            onChange={handleChange}
            required
            error={fieldErrors.status_id}
            options={statusOptions.map((s) => ({
              value: String(s.id),
              label: s.nome_status || s.descricao || `Status ${s.id}`,
            }))}
          />
          <FormField
            label="Data de instalação"
            name="data_instalacao"
            type="date"
            value={form.data_instalacao}
            onChange={handleChange}
            max={new Date().toISOString().split("T")[0]}
          />
        </div>

        <FormField
          label="Observações"
          name="observacao"
          type="textarea"
          rows={2}
          value={form.observacao}
          onChange={handleChange}
        />

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Cadastrar pneu
          </Button>
        </div>
      </form>
    </Modal>
  );
};

NovoPneuModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  caminhoes: PropTypes.array,
  posicoes: PropTypes.array,
  statusOptions: PropTypes.array,
  stockPneus: PropTypes.array,
  defaultCaminhaoId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default NovoPneuModal;
