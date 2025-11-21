// src/pages/Pneus.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import {
  Card,
  Button,
  Alert,
  LoadingSpinner,
  FormField,
} from "../components/ui";

const StatusBadge = ({ status, type = "status" }) => {
  const getStatusConfig = (statusName) => {
    const configs = {
      status: {
        // STATUS EM USO (Verde)
        "em uso": "bg-green-100 text-green-800 border-green-200",
        "recapado em uso": "bg-green-100 text-green-800 border-green-200",

        // STATUS ESTOQUE (Azul)
        "novo no estoque": "bg-blue-100 text-blue-800 border-blue-200",
        "reservado para veículo": "bg-blue-100 text-blue-800 border-blue-200",
        "instalação agendada": "bg-blue-100 text-blue-800 border-blue-200",
        "aprovado para uso": "bg-blue-100 text-blue-800 border-blue-200",
        "recapado no estoque": "bg-blue-100 text-blue-800 border-blue-200",

        // STATUS MANUTENÇÃO (Amarelo/Laranja)
        "em manutenção": "bg-yellow-100 text-yellow-800 border-yellow-200",
        "aguardando inspeção":
          "bg-yellow-100 text-yellow-800 border-yellow-200",
        "reprovado - enviar para recapagem":
          "bg-orange-100 text-orange-800 border-orange-200",
        "enviado para recapagem":
          "bg-orange-100 text-orange-800 border-orange-200",

        // STATUS DESCARTE (Vermelho)
        "enviado para descarte": "bg-red-100 text-red-800 border-red-200",
        sucata: "bg-red-100 text-red-800 border-red-200",
        "perdido/roubado": "bg-red-100 text-red-800 border-red-200",

        default: "bg-gray-100 text-gray-800 border-gray-200",
      },
      position: {
        default: "bg-purple-100 text-purple-800 border-purple-200",
      },
    };

    const configType = configs[type];
    const statusLower = statusName?.toLowerCase();

    return configType[statusLower] || configType.default;
  };

  const className = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}
    >
      {status}
    </span>
  );
};

const PneuForm = ({
  form,
  caminhoes,
  posicoes,
  statusList,
  onChange,
  onCaminhaoChange,
  onSubmit,
  loading,
}) => {
  const caminhaoOptions = caminhoes.map((c) => ({
    value: c.id,
    label: `${c.placa} - KM: ${c.km_atual?.toLocaleString("pt-BR")}`,
  }));

  const posicaoOptions = posicoes.map((p) => ({
    value: p.id,
    label: p.nome_posicao,
  }));

  const statusOptions = statusList.map((s) => ({
    value: s.id,
    label: s.nome_status,
  }));

  return (
    <Card title="Adicionar Novo Pneu" className="mb-8">
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FormField
            label="Caminhão"
            type="select"
            name="caminhao_id"
            value={form.caminhao_id}
            onChange={onCaminhaoChange}
            required
            options={caminhaoOptions}
          />

          <FormField
            label="Posição"
            type="select"
            name="posicao_id"
            value={form.posicao_id}
            onChange={onChange}
            required
            options={posicaoOptions}
          />

          <FormField
            label="Status"
            type="select"
            name="status_id"
            value={form.status_id}
            onChange={onChange}
            required
            options={statusOptions}
          />

          <FormField
            label="Marca"
            name="marca"
            value={form.marca}
            onChange={onChange}
            required
            placeholder="Ex: Michelin, Bridgestone"
          />

          <FormField
            label="Modelo"
            name="modelo"
            value={form.modelo}
            onChange={onChange}
            required
            placeholder="Ex: XZY-123"
          />

          <FormField
            label="Vida Útil (KM)"
            type="number"
            name="vida_util_km"
            value={form.vida_util_km}
            onChange={onChange}
            min="0"
            placeholder="Ex: 80000"
          />

          <FormField
            label="Data de Instalação"
            type="date"
            name="data_instalacao"
            value={form.data_instalacao}
            onChange={onChange}
            required
          />

          <FormField
            label="KM na Instalação"
            type="number"
            name="km_instalacao"
            value={form.km_instalacao}
            onChange={onChange}
            min="0"
            placeholder="KM atual do caminhão"
          />
        </div>

        <FormField
          label="Observação"
          type="textarea"
          name="observacao"
          value={form.observacao}
          onChange={onChange}
          rows={3}
          placeholder="Informações adicionais sobre o pneu..."
        />

        <div className="flex justify-end mt-4">
          <Button type="submit" loading={loading}>
            Cadastrar Pneu
          </Button>
        </div>
      </form>
    </Card>
  );
};

const PneusTable = ({
  pneus,
  caminhoes,
  onDelete,
  loading,
  filtroPlaca,
  onFiltroChange,
}) => {
  const pneusComCalculos = useMemo(() => {
    return pneus.map((pneu) => {
      const caminhao = caminhoes.find((c) => c.id === pneu.caminhao_id);
      const kmRodado =
        caminhao?.km_atual && pneu.km_instalacao
          ? caminhao.km_atual - pneu.km_instalacao
          : null;

      const vidaUtilRestante =
        pneu.vida_util_km && kmRodado ? pneu.vida_util_km - kmRodado : null;

      return {
        ...pneu,
        caminhao,
        kmRodado,
        vidaUtilRestante,
        percentualVidaUtil:
          vidaUtilRestante && pneu.vida_util_km
            ? Math.max(0, (vidaUtilRestante / pneu.vida_util_km) * 100)
            : null,
      };
    });
  }, [pneus, caminhoes]);

  const pneusFiltrados = useMemo(() => {
    if (!filtroPlaca.trim()) return pneusComCalculos;

    return pneusComCalculos.filter((pneu) =>
      pneu.caminhao?.placa?.toLowerCase().includes(filtroPlaca.toLowerCase())
    );
  }, [pneusComCalculos, filtroPlaca]);

  const estatisticas = useMemo(() => {
    const emUso = pneusComCalculos.filter(
      (p) =>
        p.status_pneus?.nome_status === "Em uso" ||
        p.status_pneus?.nome_status === "Recapado em uso"
    ).length;

    const estoque = pneusComCalculos.filter(
      (p) =>
        p.status_pneus?.nome_status === "Novo no estoque" ||
        p.status_pneus?.nome_status === "Reservado para veículo" ||
        p.status_pneus?.nome_status === "Instalação agendada" ||
        p.status_pneus?.nome_status === "Aprovado para uso" ||
        p.status_pneus?.nome_status === "Recapado no estoque"
    ).length;

    const manutencao = pneusComCalculos.filter(
      (p) =>
        p.status_pneus?.nome_status === "Em manutenção" ||
        p.status_pneus?.nome_status === "Aguardando inspeção" ||
        p.status_pneus?.nome_status === "Reprovado - enviar para recapagem" ||
        p.status_pneus?.nome_status === "Enviado para recapagem"
    ).length;

    const descarte = pneusComCalculos.filter(
      (p) =>
        p.status_pneus?.nome_status === "Enviado para descarte" ||
        p.status_pneus?.nome_status === "Sucata" ||
        p.status_pneus?.nome_status === "Perdido/Roubado"
    ).length;

    const contagemDetalhada = {};
    pneusComCalculos.forEach((pneu) => {
      const status = pneu.status_pneus?.nome_status;
      if (status) {
        contagemDetalhada[status] = (contagemDetalhada[status] || 0) + 1;
      }
    });

    return {
      total: pneusComCalculos.length,
      emUso,
      estoque,
      manutencao,
      descarte,
      detalhes: contagemDetalhada,
    };
  }, [pneusComCalculos]);

  if (loading) return <LoadingSpinner />;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Pneus Cadastrados</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100">
              {estatisticas.total} pneus
            </span>
            <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium border border-green-100">
              {estatisticas.emUso} em uso
            </span>
            <span className="bg-gray-50 text-gray-700 px-3 py-1 rounded-full text-xs font-medium border border-gray-100">
              {estatisticas.estoque} estoque
            </span>
            <span className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-xs font-medium border border-yellow-100">
              {estatisticas.manutencao} manutenção
            </span>
            <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-medium border border-red-100">
              {estatisticas.descarte} descarte
            </span>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            <details>
              <summary className="cursor-pointer hover:text-gray-800 font-medium">
                Ver detalhes por status
              </summary>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                {Object.entries(estatisticas.detalhes).map(
                  ([status, quantidade]) => (
                    <div key={status} className="flex justify-between">
                      <span>{status}:</span>
                      <span className="font-medium">{quantidade}</span>
                    </div>
                  )
                )}
              </div>
            </details>
          </div>
        </div>

        <div className="w-full lg:w-64">
          <FormField
            placeholder="Filtrar por placa..."
            value={filtroPlaca}
            onChange={onFiltroChange}
            className="mb-0"
            icon={
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            }
          />
        </div>
      </div>

      {pneusFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <div className="text-4xl mb-3 opacity-50">🚛</div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {filtroPlaca ? "Nenhum pneu encontrado" : "Nenhum pneu cadastrado"}
          </h3>
          <p className="text-gray-500 text-sm">
            {filtroPlaca
              ? `Não foram encontrados pneus para a placa "${filtroPlaca}"`
              : "Comece cadastrando o primeiro pneu no formulário acima."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Caminhão
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pneu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posição/Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  KM Rodado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vida Útil
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pneusFiltrados.map((pneu) => (
                <tr
                  key={pneu.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {pneu.caminhao?.placa || "N/A"}
                    </div>
                    <div className="text-xs text-gray-500">
                      KM:{" "}
                      {pneu.caminhao?.km_atual?.toLocaleString("pt-BR") ||
                        "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {pneu.marca} {pneu.modelo}
                    </div>
                    <div className="text-xs text-gray-500">
                      Instalado:{" "}
                      {new Date(pneu.data_instalacao).toLocaleDateString(
                        "pt-BR"
                      )}
                    </div>
                    {pneu.observacao && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                        {pneu.observacao}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      <StatusBadge
                        status={pneu.posicoes_pneus?.nome_posicao}
                        type="position"
                      />
                      <StatusBadge status={pneu.status_pneus?.nome_status} />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {pneu.kmRodado !== null
                      ? `${pneu.kmRodado.toLocaleString("pt-BR")} km`
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4">
                    {pneu.percentualVidaUtil !== null ? (
                      <div className="w-32">
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                          <div
                            className={`h-1.5 rounded-full ${
                              pneu.percentualVidaUtil > 50
                                ? "bg-green-500"
                                : pneu.percentualVidaUtil > 20
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                pneu.percentualVidaUtil
                              )}%`,
                            }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {Math.round(pneu.percentualVidaUtil)}% restante
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/pneu/editar/${pneu.id}`}
                      className="text-blue-600 hover:text-blue-900 mr-4 text-xs uppercase tracking-wide"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => onDelete(pneu.id)}
                      className="text-red-600 hover:text-red-900 text-xs uppercase tracking-wide"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

const Pneus = () => {
  const { get, post, del } = useApi();
  const [caminhoes, setCaminhoes] = useState([]);
  const [posicoes, setPosicoes] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [pneus, setPneus] = useState([]);
  const [form, setForm] = useState({
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
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filtroPlaca, setFiltroPlaca] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [caminhoesRes, posicoesRes, statusRes, pneusRes] =
        await Promise.all([
          get("/caminhoes"),
          get("/posicoes-pneus"),
          get("/status-pneus"),
          get("/pneus"),
        ]);

      // Helper para extrair dados de diferentes formatos de resposta
      const extractData = (res) => {
        if (Array.isArray(res)) return res;
        if (res?.data && Array.isArray(res.data)) return res.data;
        if (res?.success && Array.isArray(res.data)) return res.data;
        return [];
      };

      setCaminhoes(extractData(caminhoesRes));
      setPosicoes(extractData(posicoesRes));
      setStatusList(extractData(statusRes));
      setPneus(extractData(pneusRes));
    } catch (err) {
      setError("Erro ao carregar dados. Verifique a conexão com o servidor.");
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCaminhaoChange = (e) => {
    const caminhaoId = parseInt(e.target.value);
    const caminhaoSelecionado = caminhoes.find((c) => c.id === caminhaoId);

    setForm((prev) => ({
      ...prev,
      caminhao_id: caminhaoId,
      km_instalacao: caminhaoSelecionado?.km_atual || "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage("");

    try {
      const dataToSend = {
        caminhao_id: parseInt(form.caminhao_id),
        posicao_id: parseInt(form.posicao_id),
        status_id: parseInt(form.status_id),
        vida_util_km: form.vida_util_km ? parseInt(form.vida_util_km) : null,
        km_instalacao: form.km_instalacao ? parseInt(form.km_instalacao) : null,
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        data_instalacao: form.data_instalacao,
        observacao: form.observacao.trim(),
      };

      await post("/pneus", dataToSend);

      await fetchData();

      setForm({
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

      setSuccessMessage("Pneu cadastrado com sucesso!");
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setError(err.response?.data?.message || "Erro ao cadastrar pneu.");
      console.error("Erro ao cadastrar pneu:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este pneu?")) return;

    try {
      await del(`/pneus/${id}`);
      setPneus((prev) => prev.filter((p) => p.id !== id));
      setSuccessMessage("Pneu excluído com sucesso!");
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setError("Erro ao excluir pneu.");
      console.error("Erro ao excluir pneu:", err);
    }
  };

  const handleFiltroChange = (e) => {
    setFiltroPlaca(e.target.value);
  };

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-7xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              Controle de Pneus
            </h1>
            <p className="text-text-secondary text-lg">
              Gerencie a frota de pneus da sua transportadora
            </p>
          </div>
          {/* Link para cadastro em lote */}
          <Link
            to="/pneus/cadastro-em-lote"
            className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Cadastrar Pneus em Lote
          </Link>
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
        <PneuForm
          form={form}
          caminhoes={caminhoes}
          posicoes={posicoes}
          statusList={statusList}
          onChange={handleChange}
          onCaminhaoChange={handleCaminhaoChange}
          onSubmit={handleSubmit}
          loading={submitting}
        />

        {/* Tabela de Pneus */}
        <PneusTable
          pneus={pneus}
          caminhoes={caminhoes}
          onDelete={handleDelete}
          loading={loading}
          filtroPlaca={filtroPlaca}
          onFiltroChange={handleFiltroChange}
        />
      </div>
    </div>
  );
};

export default Pneus;
