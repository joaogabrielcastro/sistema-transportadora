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

const EditGasto = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { get, put } = useApi();

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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  // IDs dos tipos de gasto especiais
  const ID_TIPO_GASTO_COMBUSTIVEL = 9;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [gastoRes, tiposRes, caminhoesRes] = await Promise.all([
          get(`/gastos/${id}`),
          get("/tipos-gastos"),
          get("/caminhoes"),
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

        const gastoData = extractData(gastoRes);
        const tiposData = extractArray(tiposRes);
        const caminhoesData = extractArray(caminhoesRes);

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

        setTiposGastos(tiposData);
        setCaminhoes(caminhoesData);
      } catch (err) {
        console.error("Erro completo:", err);
        setError(
          "Erro ao carregar dados do gasto. Verifique a conexão com o servidor."
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
    setError(null);
    setSuccessMessage("");

    try {
      const isCombustivel =
        parseInt(formData.tipo_gasto_id) === ID_TIPO_GASTO_COMBUSTIVEL;

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

      setSuccessMessage("Gasto atualizado com sucesso!");

      // Redireciona após 2 segundos
      setTimeout(() => {
        navigate(
          caminhaoPlaca ? `/caminhao/${caminhaoPlaca}` : "/manutencao-gastos"
        );
      }, 2000);
    } catch (err) {
      console.error("Erro completo:", err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Erro ao atualizar o gasto. Verifique os dados e tente novamente."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isCombustivel =
    parseInt(formData.tipo_gasto_id) === ID_TIPO_GASTO_COMBUSTIVEL;
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

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-2xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Link
            to={
              caminhaoPlaca
                ? `/caminhao/${caminhaoPlaca}`
                : "/manutencao-gastos"
            }
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
          <h1 className="text-3xl font-bold text-text-primary">Editar Gasto</h1>
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
      </div>
    </div>
  );
};

export default EditGasto;
