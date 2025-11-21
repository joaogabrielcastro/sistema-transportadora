import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import {
  Card,
  Button,
  Alert,
  LoadingSpinner,
  FormField,
} from "../components/ui";

const EditChecklist = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { get, put } = useApi();

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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [checklistRes, caminhoesRes, itensRes] = await Promise.all([
          get(`/checklist/${id}`),
          get("/caminhoes"),
          get("/itens-checklist"),
        ]);

        const extractData = (res) => {
          if (res?.data) return res.data;
          return res;
        };

        const extractArray = (res) => {
          if (Array.isArray(res)) return res;
          if (res?.data && Array.isArray(res.data)) return res.data;
          if (res?.data?.data && Array.isArray(res.data.data))
            return res.data.data;
          return [];
        };

        const checklistData = extractData(checklistRes);
        const caminhoesData = extractArray(caminhoesRes);
        const itensData = extractArray(itensRes);

        setFormData({
          caminhao_id: checklistData.caminhao_id || "",
          item_id: checklistData.item_id || "",
          data_manutencao: checklistData.data_manutencao
            ? new Date(checklistData.data_manutencao)
                .toISOString()
                .split("T")[0]
            : "",
          observacao: checklistData.observacao || "",
          valor: checklistData.valor || "",
          oficina: checklistData.oficina || "",
          km_registro: checklistData.km_manutencao || "",
        });

        setCaminhoes(caminhoesData);
        setItensChecklist(itensData);
      } catch (err) {
        console.error("Erro completo:", err);
        setError(
          "Erro ao carregar dados para edição. Verifique a conexão com o servidor."
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, get]);

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
    setError(null);
    setSuccessMessage("");

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

      setSuccessMessage("Manutenção atualizada com sucesso!");

      // Redireciona após 2 segundos
      setTimeout(() => {
        navigate("/manutencao-gastos");
      }, 2000);
    } catch (err) {
      console.error("Erro completo:", err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Erro ao atualizar a manutenção. Verifique os dados e tente novamente."
      );
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

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-2xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Link
            to="/manutencao-gastos"
            className="flex items-center text-primary hover:text-primary-dark mr-4 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Voltar
          </Link>
          <h1 className="text-3xl font-bold text-text-primary">
            Editar Manutenção
          </h1>
        </div>

        {/* Mensagens de Feedback */}
        {error && (
          <div className="mb-6">
            <Alert type="error" message={error} />
          </div>
        )}
        {successMessage && (
          <div className="mb-6">
            <Alert type="success" message={successMessage} />
          </div>
        )}

        {/* Formulário */}
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
      </div>
    </div>
  );
};

export default EditChecklist;
