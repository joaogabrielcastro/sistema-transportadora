import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useApi } from "../hooks/useApi";
import {
  Card,
  Button,
  FormField,
  Alert,
  LoadingSpinner,
} from "../components/ui";

// Schema de validação para um único pneu
const pneuSchema = z.object({
  marca: z.string().min(1, "Marca é obrigatória"),
  modelo: z.string().min(1, "Modelo é obrigatório"),
  data_instalacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  km_instalacao: z.number().min(0, "KM deve ser positivo"),
  posicao_id: z.number().min(1, "Posição é obrigatória"),
  status_id: z.number().min(1, "Status é obrigatório"),
  observacao: z.string().optional(),
});

const CadastroPneuEmLote = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { get, post } = useApi();
  const caminhaoIdFromState = location.state?.caminhaoId;

  const [pneus, setPneus] = useState([
    {
      id: 1,
      marca: "",
      modelo: "",
      data_instalacao: new Date().toISOString().split("T")[0],
      km_instalacao: "",
      posicao_pneu_id: "",
      status_pneu_id: "",
      observacao: "",
    },
  ]);
  const [caminhaoId, setCaminhaoId] = useState(caminhaoIdFromState || "");
  const [caminhoes, setCaminhoes] = useState([]);
  const [posicoes, setPosicoes] = useState([]);
  const [status, setStatus] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  // Carregar dados iniciais (caminhões, posições, status)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [caminhoesData, posicoesData, statusData] = await Promise.all([
          get("/caminhoes?limit=1000"), // Busca todos os caminhões
          get("/posicoes-pneus"),
          get("/status-pneus"),
        ]);

        setCaminhoes(caminhoesData.data || caminhoesData || []);
        setPosicoes(posicoesData.data || posicoesData || []);
        setStatus(statusData.data || statusData || []);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        setErrors({ form: "Erro ao carregar dados iniciais." });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [get]);

  const handleAddPneu = () => {
    setPneus([
      ...pneus,
      {
        id: Date.now(),
        marca: "",
        modelo: "",
        data_instalacao: new Date().toISOString().split("T")[0],
        km_instalacao: "",
        posicao_pneu_id: "",
        status_pneu_id: "",
        observacao: "",
      },
    ]);
  };

  const handleRemovePneu = (id) => {
    if (pneus.length > 1) {
      setPneus(pneus.filter((p) => p.id !== id));
    }
  };

  const handleChange = (id, field, value) => {
    const newPneus = pneus.map((p) => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    });
    setPneus(newPneus);

    // Limpar erro do campo específico se existir
    if (errors[id] && errors[id][field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        if (newErrors[id]) {
          const newPneuErrors = { ...newErrors[id] };
          delete newPneuErrors[field];
          newErrors[id] = newPneuErrors;
        }
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setSuccessMessage("");

    if (!caminhaoId) {
      setErrors({ form: "Selecione um caminhão." });
      setSubmitting(false);
      return;
    }

    const pneusParaValidar = pneus.map((p) => ({
      caminhao_id: parseInt(caminhaoId),
      marca: p.marca,
      modelo: p.modelo,
      data_instalacao: p.data_instalacao,
      km_instalacao: p.km_instalacao ? parseInt(p.km_instalacao) : 0,
      posicao_id: p.posicao_pneu_id ? parseInt(p.posicao_pneu_id) : 0,
      status_id: p.status_pneu_id ? parseInt(p.status_pneu_id) : 0,
      observacao: p.observacao,
    }));

    // Validação com Zod
    const validationResults = pneusParaValidar.map((p) =>
      pneuSchema.safeParse(p)
    );
    const newErrors = {};
    let hasErrors = false;

    validationResults.forEach((result, index) => {
      if (!result.success) {
        hasErrors = true;
        newErrors[pneus[index].id] = result.error.issues.reduce(
          (acc, issue) => {
            acc[issue.path[0]] = issue.message;
            return acc;
          },
          {}
        );
      }
    });

    if (hasErrors) {
      setErrors(newErrors);
      setSubmitting(false);
      return;
    }

    try {
      await post("/pneus/bulk", {
        pneus: pneusParaValidar,
      });
      setSuccessMessage("Pneus cadastrados com sucesso!");
      setTimeout(() => {
        const caminhao = caminhoes.find((c) => c.id == caminhaoId);
        if (caminhao) {
          navigate(`/caminhao/${caminhao.placa}`);
        } else {
          navigate("/pneus");
        }
      }, 2000);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      setErrors({
        form: error.response?.data?.error || "Erro ao cadastrar pneus.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  const caminhaoOptions = caminhoes.map((c) => ({
    value: c.id,
    label: `${c.placa} - ${c.motorista || "Sem motorista"}`,
  }));

  const posicaoOptions = posicoes.map((p) => ({
    value: p.id,
    label: p.nome_posicao,
  }));

  const statusOptions = status.map((s) => ({
    value: s.id,
    label: s.nome_status,
  }));

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-4xl mx-auto animate-fade-in">
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
            Voltar
          </Link>
          <h1 className="text-3xl font-bold text-text-primary">
            Cadastro de Pneus em Lote
          </h1>
        </div>

        {errors.form && (
          <div className="mb-6">
            <Alert type="error" message={errors.form} />
          </div>
        )}
        {successMessage && (
          <div className="mb-6">
            <Alert type="success" message={successMessage} />
          </div>
        )}

        <Card>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Seleção do Caminhão */}
            <FormField
              label="Selecione o Caminhão"
              type="select"
              value={caminhaoId}
              onChange={(e) => setCaminhaoId(e.target.value)}
              options={caminhaoOptions}
              required
              placeholder="-- Escolha um caminhão --"
            />

            {/* Lista de Pneus */}
            <div className="space-y-6">
              {pneus.map((pneu, index) => (
                <div
                  key={pneu.id}
                  className="border border-border p-6 rounded-xl bg-gray-50 relative transition-all hover:shadow-sm"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg text-text-primary">
                      Pneu {index + 1}
                    </h3>
                    {pneus.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePneu(pneu.id)}
                        className="text-danger hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                        title="Remover pneu"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      label="Marca"
                      value={pneu.marca}
                      onChange={(e) =>
                        handleChange(pneu.id, "marca", e.target.value)
                      }
                      error={errors[pneu.id]?.marca}
                      placeholder="Ex: Michelin"
                    />

                    <FormField
                      label="Modelo"
                      value={pneu.modelo}
                      onChange={(e) =>
                        handleChange(pneu.id, "modelo", e.target.value)
                      }
                      error={errors[pneu.id]?.modelo}
                      placeholder="Ex: XZY-123"
                    />

                    <FormField
                      label="Data de Instalação"
                      type="date"
                      value={pneu.data_instalacao}
                      onChange={(e) =>
                        handleChange(pneu.id, "data_instalacao", e.target.value)
                      }
                      error={errors[pneu.id]?.data_instalacao}
                    />

                    <FormField
                      label="KM de Instalação"
                      type="number"
                      value={pneu.km_instalacao}
                      onChange={(e) =>
                        handleChange(pneu.id, "km_instalacao", e.target.value)
                      }
                      error={errors[pneu.id]?.km_instalacao}
                      placeholder="Ex: 50000"
                    />

                    <FormField
                      label="Posição"
                      type="select"
                      value={pneu.posicao_pneu_id}
                      onChange={(e) =>
                        handleChange(pneu.id, "posicao_pneu_id", e.target.value)
                      }
                      options={posicaoOptions}
                      error={errors[pneu.id]?.posicao_pneu_id}
                      placeholder="-- Selecione --"
                    />

                    <FormField
                      label="Status"
                      type="select"
                      value={pneu.status_pneu_id}
                      onChange={(e) =>
                        handleChange(pneu.id, "status_pneu_id", e.target.value)
                      }
                      options={statusOptions}
                      error={errors[pneu.id]?.status_pneu_id}
                      placeholder="-- Selecione --"
                    />
                  </div>

                  <div className="mt-4">
                    <FormField
                      label="Observação (opcional)"
                      type="textarea"
                      value={pneu.observacao}
                      onChange={(e) =>
                        handleChange(pneu.id, "observacao", e.target.value)
                      }
                      rows={2}
                      placeholder="Detalhes adicionais..."
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Botão para adicionar mais pneus */}
            <Button
              type="button"
              variant="outline"
              onClick={handleAddPneu}
              className="w-full border-dashed"
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              }
            >
              Adicionar outro pneu
            </Button>

            {/* Botões de Ação */}
            <div className="flex gap-4 pt-4 border-t border-border">
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
                {`Cadastrar ${pneus.length} Pneu(s)`}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default CadastroPneuEmLote;
