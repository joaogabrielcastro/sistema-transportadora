import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApiMutation, useEditChecklistQuery } from "../hooks";
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

const EditChecklist = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { put } = useApiMutation();

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useEditChecklistQuery(id);

  const [formData, setFormData] = useState({
    caminhao_id: "",
    item_id: "",
    data_manutencao: "",
    observacao: "",
    valor: "",
    oficina: "",
    km_registro: "",
  });
  const [caminhoes, setCaminhoes] = useState([]);
  const [itensChecklist, setItensChecklist] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const loadError = queryError?.message || null;

  useEffect(() => {
    if (!data) return;

    const checklistData = data.checklist;
    setFormData({
      caminhao_id: checklistData.caminhao_id || "",
      item_id: checklistData.item_id || "",
      data_manutencao: checklistData.data_manutencao
        ? new Date(checklistData.data_manutencao).toISOString().split("T")[0]
        : "",
      observacao: checklistData.observacao || "",
      valor: checklistData.valor || "",
      oficina: checklistData.oficina || "",
      km_registro: checklistData.km_manutencao || "",
    });
    setCaminhoes(data.caminhoes);
    setItensChecklist(data.itensChecklist);
  }, [data, id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        caminhao_id: parseInt(formData.caminhao_id),
        item_id: parseInt(formData.item_id),
        data_manutencao: formData.data_manutencao,
        observacao: formData.observacao,
        valor: formData.valor ? parseFloat(formData.valor) : null,
        oficina: formData.oficina,
        km_manutencao: formData.km_registro
          ? parseInt(formData.km_registro)
          : null,
      };

      await put(`/checklist/${id}`, payload);

      // Redireciona após 2 segundos
      setTimeout(() => {
        navigate("/manutencao-gastos");
      }, 2000);
    } catch (err) {
      console.error("Erro completo:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const caminhaoOptions = caminhoes.map((c) => ({
    value: c.id,
    label: `${c.placa} - KM: ${c.km_atual?.toLocaleString("pt-BR")}`,
  }));

  const itemOptions = itensChecklist.map((item) => ({
    value: item.id,
    label: item.nome_item,
  }));

  const caminhaoPlaca =
    caminhoes.find((c) => c.id === parseInt(formData.caminhao_id))?.placa || "";

  const breadcrumbItems = [
    { label: "Início", to: "/" },
    { label: "Manutenção", to: "/manutencao-gastos" },
    ...(caminhaoPlaca
      ? [{ label: caminhaoPlaca, to: `/caminhao/${caminhaoPlaca}` }]
      : []),
    { label: "Editar manutenção" },
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
        <Alert
          type="error"
          title="Manutenção não encontrada"
          message={loadError}
        />
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
        title="Editar manutenção"
        subtitle={
          caminhaoPlaca
            ? `Atualize os dados da manutenção do caminhão ${caminhaoPlaca}`
            : "Atualize os dados da manutenção"
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
                onChange={handleChange}
                options={caminhaoOptions}
                disabled
              />

              <FormField
                label="Item de Manutenção"
                type="select"
                name="item_id"
                value={formData.item_id}
                onChange={handleChange}
                required
                options={itemOptions}
              />

              <FormField
                label="Data da Manutenção"
                type="date"
                name="data_manutencao"
                value={formData.data_manutencao}
                onChange={handleChange}
                required
                max={new Date().toISOString().split("T")[0]}
              />

              <FormField
                label="Valor (R$)"
                type="number"
                name="valor"
                value={formData.valor}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="0,00"
                icon={<span className="text-gray-500 font-semibold">R$</span>}
              />

              <FormField
                label="Quilometragem (KM)"
                type="number"
                name="km_registro"
                value={formData.km_registro}
                onChange={handleChange}
                min="0"
                placeholder="KM no momento da manutenção"
              />

              <FormField
                label="Oficina"
                type="text"
                name="oficina"
                value={formData.oficina}
                onChange={handleChange}
                placeholder="Nome da oficina"
              />
            </div>

            <FormField
              label="Observação"
              type="textarea"
              name="observacao"
              value={formData.observacao}
              onChange={handleChange}
              rows={4}
              placeholder="Detalhes adicionais sobre a manutenção..."
            />

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate("/manutencao-gastos")}
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

export default EditChecklist;
