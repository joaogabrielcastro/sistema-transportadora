import React, { useState, useEffect, useCallback } from "react";
import { useApi } from "../hooks/useApi.js";
import {
  Card,
  Button,
  LoadingSpinner,
  FormField,
} from "../components/ui";
import { useSearchParams, useNavigate } from "react-router-dom";

const PneuAtribuir = () => {
  const { get, post } = useApi();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialPneuId = searchParams.get("pneu_id") || "";

  // Estados de dados
  const [pneus, setPneus] = useState([]);
  const [caminhoes, setCaminhoes] = useState([]);
  const [posicoes, setPosicoes] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);

  // Estados de formulário e UI
  const [form, setForm] = useState({
    stock_pneu_id: initialPneuId,
    caminhao_id: "",
    posicao_id: "",
    status_id: "",
    data_instalacao: new Date().toISOString().split("T")[0],
    km_instalacao: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, cRes, posRes, statusRes] = await Promise.all([
        get("/pneus/in-stock"),
        get("/caminhoes"),
        get("/posicoes-pneus"),
        get("/status-pneus"),
      ]);

      const extractData = (res) => (Array.isArray(res) ? res : res?.data || []);

      setPneus(extractData(pRes));
      setCaminhoes(extractData(cRes));
      setPosicoes(extractData(posRes));
      setStatusOptions(extractData(statusRes));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Atualiza campo de KM quando caminhão é selecionado
  const handleCaminhaoChange = (e) => {
    const caminhaoId = parseInt(e.target.value);
    const caminhao = caminhoes.find((c) => c.id === caminhaoId);

    setForm((prev) => ({
      ...prev,
      caminhao_id: caminhaoId,
      km_instalacao: caminhao ? caminhao.km_atual : prev.km_instalacao,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "caminhao_id") {
      handleCaminhaoChange(e);
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors({});

    if (
      !form.stock_pneu_id ||
      !form.caminhao_id ||
      !form.posicao_id ||
      !form.status_id
    ) {
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        stock_pneu_id: parseInt(form.stock_pneu_id),
        caminhao_id: parseInt(form.caminhao_id),
        posicao_id: parseInt(form.posicao_id),
        status_id: parseInt(form.status_id),
        data_instalacao: form.data_instalacao,
        km_instalacao: form.km_instalacao ? parseInt(form.km_instalacao) : null,
      };

      await post("/pneus", payload);
      setTimeout(() => navigate("/pneus"), 1500);
    } catch (err) {
      console.error(err);
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center min-h-screen pt-24">
        <LoadingSpinner />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Atribuir Pneu do Estoque
          </h1>
          <p className="text-gray-600">
            Selecione um pneu do estoque e instale em um caminhão.
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Pneu (em estoque)"
              name="stock_pneu_id"
              type="select"
              value={form.stock_pneu_id}
              onChange={handleChange}
              placeholder="Selecione o pneu"
              error={fieldErrors.stock_pneu_id}
              options={pneus.map((p) => ({
                value: p.id,
                label: `${p.marca} ${p.modelo} ${p.dot ? `(DOT: ${p.dot})` : ""}`,
              }))}
            />
            <FormField
              label="Data de Instalação"
              name="data_instalacao"
              type="date"
              value={form.data_instalacao}
              onChange={handleChange}
              max={new Date().toISOString().split("T")[0]}
              error={fieldErrors.data_instalacao}
            />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Caminhão"
                name="caminhao_id"
                type="select"
                value={form.caminhao_id}
                onChange={handleChange}
                placeholder="Selecione o caminhão"
                error={fieldErrors.caminhao_id}
                options={caminhoes.map((c) => ({
                  value: c.id,
                  label: `${c.placa} - ${c.modelo || "Modelo N/A"}`,
                }))}
              />

              <FormField
                label="Posição"
                name="posicao_id"
                type="select"
                value={form.posicao_id}
                onChange={handleChange}
                placeholder="Selecione a posição"
                error={fieldErrors.posicao_id}
                options={posicoes.map((p) => ({
                  value: p.id,
                  label: p.nome_posicao,
                }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Status Inicial"
                name="status_id"
                type="select"
                value={form.status_id}
                onChange={handleChange}
                options={statusOptions.map((s) => ({
                  value: s.id,
                  label: s.nome_status || s.descricao || `Status ${s.id}`,
                }))}
                placeholder="Selecione o status"
                helperText="Geralmente 'Em uso' para pneus novos instalados."
                error={fieldErrors.status_id}
              />
              <FormField
                label="KM Atual do Caminhão"
                name="km_instalacao"
                type="number"
                value={form.km_instalacao}
                onChange={handleChange}
                placeholder="Ex: 154000"
                helperText="KM do caminhão no momento da instalação"
                error={fieldErrors.km_instalacao}
              />
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                className="mr-2"
                onClick={() => navigate("/pneus/estoque")}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={submitting}>
                Atribuir Pneu
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default PneuAtribuir;
