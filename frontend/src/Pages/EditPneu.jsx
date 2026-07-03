// src/pages/EditPneu.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApiMutation, useEditPneuQuery } from "../hooks";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import { CardSkeleton } from "../components/Skeleton.jsx";
import {
  Card,
  Button,
  FormField,
  Alert,
  PageHeader,
} from "../components/ui";

const EditPneu = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { put } = useApiMutation();

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useEditPneuQuery(id);

  const [formData, setFormData] = useState({
    caminhao_id: "",
    posicao_id: "",
    status_id: "",
    vida_util_km: "",
    marca: "",
    modelo: "",
    data_instalacao: "",
    km_instalacao: "",
    observacao: "",
  });
  const [caminhoes, setCaminhoes] = useState([]);
  const [posicoes, setPosicoes] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const loadError = queryError?.message || null;

  useEffect(() => {
    if (!data) return;

    const pneuData = data.pneu;
    setFormData({
      caminhao_id: pneuData.caminhao_id || "",
      posicao_id: pneuData.posicao_id || "",
      status_id: pneuData.status_id || "",
      vida_util_km: pneuData.vida_util_km || "",
      marca: pneuData.marca || "",
      modelo: pneuData.modelo || "",
      data_instalacao: pneuData.data_instalacao
        ? new Date(pneuData.data_instalacao).toISOString().split("T")[0]
        : "",
      km_instalacao: pneuData.km_instalacao || "",
      observacao: pneuData.observacao || "",
    });
    setCaminhoes(data.caminhoes);
    setPosicoes(data.posicoes);
    setStatusList(data.statusList);
  }, [data, id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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

    try {
      const payload = {
        caminhao_id: parseInt(formData.caminhao_id),
        posicao_id: parseInt(formData.posicao_id),
        status_id: parseInt(formData.status_id),
        vida_util_km: formData.vida_util_km
          ? parseInt(formData.vida_util_km)
          : null,
        marca: formData.marca,
        modelo: formData.modelo,
        data_instalacao: formData.data_instalacao,
        km_instalacao: formData.km_instalacao
          ? parseInt(formData.km_instalacao)
          : null,
        observacao: formData.observacao,
      };

      await put(`/pneus/${id}`, payload);

      // Redireciona após 2 segundos
      setTimeout(() => {
        navigate("/pneus");
      }, 2000);
    } catch (err) {
      console.error("Erro completo:", err);
      if (err?.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const caminhaoSelecionado = caminhoes.find(
    (c) => c.id === parseInt(formData.caminhao_id)
  );

  const caminhaoOptions = caminhoes.map((c) => ({
    value: c.id,
    label: c.placa,
  }));

  const posicaoOptions = posicoes.map((p) => ({
    value: p.id,
    label: p.nome_posicao,
  }));

  const statusOptions = statusList.map((s) => ({
    value: s.id,
    label: s.nome_status,
  }));

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
        <Alert type="error" title="Pneu não encontrado" message={loadError} />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Voltar
          </Button>
          <Button onClick={() => navigate("/pneus")}>Ir para pneus</Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout narrow className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Início", to: "/" },
          { label: "Pneus", to: "/pneus" },
          { label: "Editar pneu" },
        ]}
      />
      <PageHeader
        title="Editar pneu"
        subtitle="Atualize os dados do pneu"
      />

      <Card>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                label="Caminhão"
                type="select"
                name="caminhao_id"
                value={formData.caminhao_id}
                onChange={handleChange}
                options={caminhaoOptions}
                disabled
                helperText={
                  caminhaoSelecionado
                    ? `KM atual: ${caminhaoSelecionado.km_atual?.toLocaleString(
                        "pt-BR"
                      )}`
                    : ""
                }
              />

              <FormField
                label="Posição"
                type="select"
                name="posicao_id"
                value={formData.posicao_id}
                onChange={handleChange}
                required
                options={posicaoOptions}
                error={fieldErrors.posicao_id}
              />

              <FormField
                label="Status"
                type="select"
                name="status_id"
                value={formData.status_id}
                onChange={handleChange}
                required
                options={statusOptions}
                error={fieldErrors.status_id}
              />

              <FormField
                label="Vida Útil (KM)"
                type="number"
                name="vida_util_km"
                value={formData.vida_util_km}
                onChange={handleChange}
                min="0"
                placeholder="Ex: 80000"
              />

              <FormField
                label="Marca"
                type="text"
                name="marca"
                value={formData.marca}
                onChange={handleChange}
                required
                placeholder="Ex: Michelin, Goodyear"
                error={fieldErrors.marca}
              />

              <FormField
                label="Modelo"
                type="text"
                name="modelo"
                value={formData.modelo}
                onChange={handleChange}
                required
                placeholder="Ex: XZY-123"
                error={fieldErrors.modelo}
              />

              <FormField
                label="Data de Instalação"
                type="date"
                name="data_instalacao"
                value={formData.data_instalacao}
                onChange={handleChange}
                required
                max={new Date().toISOString().split("T")[0]}
                error={fieldErrors.data_instalacao}
              />

              <FormField
                label="KM na Instalação"
                type="number"
                name="km_instalacao"
                value={formData.km_instalacao}
                onChange={handleChange}
                min="0"
                required
                placeholder="KM do veículo na instalação"
                helperText={
                  caminhaoSelecionado
                    ? `KM atual do caminhão: ${caminhaoSelecionado.km_atual?.toLocaleString(
                        "pt-BR"
                      )}`
                    : ""
                }
                error={fieldErrors.km_instalacao}
              />
            </div>

            <FormField
              label="Observação"
              type="textarea"
              name="observacao"
              value={formData.observacao}
              onChange={handleChange}
              rows={4}
              placeholder="Informações adicionais sobre o pneu..."
            />

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate("/pneus")}
                disabled={submitting}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" loading={submitting} className="flex-1">
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Card>
    </PageLayout>
  );
};

export default EditPneu;
