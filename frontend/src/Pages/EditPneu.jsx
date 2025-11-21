// src/pages/EditPneu.jsx
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

const EditPneu = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { get, put } = useApi();

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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [pneuRes, caminhoesRes, posicoesRes, statusRes] =
          await Promise.all([
            get(`/pneus/${id}`),
            get("/caminhoes"),
            get("/posicoes-pneus"),
            get("/status-pneus"),
          ]);

        // Helper para extrair dados
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

        const pneuData = extractData(pneuRes);
        const caminhoesData = extractArray(caminhoesRes);
        const posicoesData = extractArray(posicoesRes);
        const statusData = extractArray(statusRes);

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

        setCaminhoes(caminhoesData);
        setPosicoes(posicoesData);
        setStatusList(statusData);
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

      setSuccessMessage("Pneu atualizado com sucesso!");

      // Redireciona após 2 segundos
      setTimeout(() => {
        navigate("/pneus");
      }, 2000);
    } catch (err) {
      console.error("Erro completo:", err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Erro ao atualizar o pneu. Verifique os dados e tente novamente."
      );
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

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-2xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Link
            to="/pneus"
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
            Voltar para Pneus
          </Link>
          <h1 className="text-3xl font-bold text-text-primary">Editar Pneu</h1>
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
              />

              <FormField
                label="Status"
                type="select"
                name="status_id"
                value={formData.status_id}
                onChange={handleChange}
                required
                options={statusOptions}
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
              />

              <FormField
                label="Modelo"
                type="text"
                name="modelo"
                value={formData.modelo}
                onChange={handleChange}
                required
                placeholder="Ex: XZY-123"
              />

              <FormField
                label="Data de Instalação"
                type="date"
                name="data_instalacao"
                value={formData.data_instalacao}
                onChange={handleChange}
                required
                max={new Date().toISOString().split("T")[0]}
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
      </div>
    </div>
  );
};

export default EditPneu;
