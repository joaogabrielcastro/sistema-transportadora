import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApiMutation, useEditGastoQuery } from "../hooks";
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
import { isCombustivelTipo } from "../utils/tipoGastoUtils.js";

const EditGasto = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { put } = useApiMutation();

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useEditGastoQuery(id);

  const [caminhaoPlaca, setCaminhaoPlaca] = useState("");
  const [formData, setFormData] = useState({
    caminhao_id: "",
    tipo_gasto_id: "",
    valor: "",
    data_gasto: "",
    descricao: "",
    km_registro: "",
    quantidade_combustivel: "",
  });
  const [tiposGastos, setTiposGastos] = useState([]);
  const [caminhoes, setCaminhoes] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const loadError = queryError?.message || null;

  useEffect(() => {
    if (!data) return;

    const gastoData = data.gasto;
    setCaminhaoPlaca(gastoData.caminhoes?.placa || "");
    setFormData({
      caminhao_id: gastoData.caminhao_id || "",
      tipo_gasto_id: gastoData.tipo_gasto_id || "",
      valor: gastoData.valor || "",
      data_gasto: gastoData.data_gasto
        ? new Date(gastoData.data_gasto).toISOString().split("T")[0]
        : "",
      descricao: gastoData.descricao || "",
      km_registro: gastoData.km_registro || "",
      quantidade_combustivel: gastoData.quantidade_combustivel || "",
    });
    setTiposGastos(data.tiposGastos);
    setCaminhoes(data.caminhoes);
  }, [data, id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCaminhaoChange = (e) => {
    const caminhaoId = e.target.value;
    const caminhaoSelecionado = caminhoes.find(
      (c) => c.id === parseInt(caminhaoId)
    );

    setFormData((prev) => ({
      ...prev,
      caminhao_id: caminhaoId,
      km_registro: caminhaoSelecionado?.km_atual || prev.km_registro,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const isCombustivel = isCombustivelTipo(
        formData.tipo_gasto_id,
        tiposGastos,
      );

      const payload = {
        caminhao_id: parseInt(formData.caminhao_id),
        tipo_gasto_id: parseInt(formData.tipo_gasto_id),
        valor: parseFloat(formData.valor),
        data_gasto: formData.data_gasto,
        descricao: formData.descricao,
        km_registro: formData.km_registro
          ? parseInt(formData.km_registro)
          : null,
        quantidade_combustivel:
          isCombustivel && formData.quantidade_combustivel
            ? parseFloat(formData.quantidade_combustivel)
            : null,
      };

      await put(`/gastos/${id}`, payload);

      // Redireciona após 2 segundos
      setTimeout(() => {
        navigate(
          caminhaoPlaca ? `/caminhao/${caminhaoPlaca}` : "/manutencao-gastos"
        );
      }, 2000);
    } catch (err) {
      console.error("Erro completo:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const isCombustivel = isCombustivelTipo(formData.tipo_gasto_id, tiposGastos);
  const caminhaoSelecionado = caminhoes.find(
    (c) => c.id === parseInt(formData.caminhao_id)
  );

  const caminhaoOptions = caminhoes.map((c) => ({
    value: c.id,
    label: `${c.placa} - KM: ${c.km_atual?.toLocaleString("pt-BR")}`,
  }));

  const tipoOptions = tiposGastos.map((t) => ({
    value: t.id,
    label: t.nome_tipo,
  }));

  const breadcrumbItems = [
    { label: "Início", to: "/" },
    { label: "Manutenção", to: "/manutencao-gastos" },
    ...(caminhaoPlaca
      ? [{ label: caminhaoPlaca, to: `/caminhao/${caminhaoPlaca}` }]
      : []),
    { label: "Editar gasto" },
  ];

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
        <Alert type="error" title="Gasto não encontrado" message={loadError} />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Voltar
          </Button>
          <Button onClick={() => navigate("/manutencao-gastos")}>
            Ir para manutenção
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout narrow className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      <PageHeader
        title="Editar gasto"
        subtitle={
          caminhaoPlaca
            ? `Atualize os dados do gasto do caminhão ${caminhaoPlaca}`
            : "Atualize os dados do gasto"
        }
      />

      <Card>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              label="Caminhão"
              type="select"
              name="caminhao_id"
              value={formData.caminhao_id}
              onChange={handleCaminhaoChange}
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
              label="Tipo de Gasto"
              type="select"
              name="tipo_gasto_id"
              value={formData.tipo_gasto_id}
              onChange={handleChange}
              required
              options={tipoOptions}
            />

            <FormField
              label="Valor (R$)"
              type="number"
              name="valor"
              value={formData.valor}
              onChange={handleChange}
              step="0.01"
              min="0"
              required
              placeholder="0,00"
              icon={<span className="text-gray-500 font-semibold">R$</span>}
            />

            <FormField
              label="Data do Gasto"
              type="date"
              name="data_gasto"
              value={formData.data_gasto}
              onChange={handleChange}
              required
              max={new Date().toISOString().split("T")[0]}
            />

            <FormField
              label="Quilometragem (KM)"
              type="number"
              name="km_registro"
              value={formData.km_registro}
              onChange={handleChange}
              min="0"
              placeholder="KM no momento do gasto"
            />

            {isCombustivel && (
              <FormField
                label="Quantidade (Litros)"
                type="number"
                name="quantidade_combustivel"
                value={formData.quantidade_combustivel}
                onChange={handleChange}
                step="0.01"
                min="0"
                required
                placeholder="0,00"
              />
            )}
          </div>

          <FormField
            label="Observação"
            type="textarea"
            name="descricao"
            value={formData.descricao}
            onChange={handleChange}
            rows={4}
            placeholder="Detalhes adicionais sobre o gasto..."
          />

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                navigate(
                  caminhaoPlaca
                    ? `/caminhao/${caminhaoPlaca}`
                    : "/manutencao-gastos"
                )
              }
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

export default EditGasto;
