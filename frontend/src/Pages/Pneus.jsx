// src/pages/Pneus.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

// Componentes Reutilizáveis
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-20">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

const ErrorMessage = ({ message, onRetry }) => (
  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6">
    <div className="flex justify-between items-center">
      <p className="font-medium">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-4 bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 transition-colors"
        >
          Tentar Novamente
        </button>
      )}
    </div>
  </div>
);

const SuccessMessage = ({ message }) => (
  <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-lg mb-6">
    <div className="flex items-center">
      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      <span className="font-medium">{message}</span>
    </div>
  </div>
);

const StatusBadge = ({ status, type = "status" }) => {
  const getStatusConfig = (statusName) => {
    const configs = {
      status: {
        // STATUS EM USO (Verde)
        "em uso": {
          bg: "bg-green-100",
          text: "text-green-800",
          border: "border-green-200",
        },
        "recapado em uso": {
          bg: "bg-green-100",
          text: "text-green-800",
          border: "border-green-200",
        },

        // STATUS ESTOQUE (Azul)
        "novo no estoque": {
          bg: "bg-blue-100",
          text: "text-blue-800",
          border: "border-blue-200",
        },
        "reservado para veículo": {
          bg: "bg-blue-100",
          text: "text-blue-800",
          border: "border-blue-200",
        },
        "instalação agendada": {
          bg: "bg-blue-100",
          text: "text-blue-800",
          border: "border-blue-200",
        },
        "aprovado para uso": {
          bg: "bg-blue-100",
          text: "text-blue-800",
          border: "border-blue-200",
        },
        "recapado no estoque": {
          bg: "bg-blue-100",
          text: "text-blue-800",
          border: "border-blue-200",
        },

        // STATUS MANUTENÇÃO (Amarelo/Laranja)
        "em manutenção": {
          bg: "bg-yellow-100",
          text: "text-yellow-800",
          border: "border-yellow-200",
        },
        "aguardando inspeção": {
          bg: "bg-yellow-100",
          text: "text-yellow-800",
          border: "border-yellow-200",
        },
        "reprovado - enviar para recapagem": {
          bg: "bg-orange-100",
          text: "text-orange-800",
          border: "border-orange-200",
        },
        "enviado para recapagem": {
          bg: "bg-orange-100",
          text: "text-orange-800",
          border: "border-orange-200",
        },

        // STATUS DESCARTE (Vermelho)
        "enviado para descarte": {
          bg: "bg-red-100",
          text: "text-red-800",
          border: "border-red-200",
        },
        sucata: {
          bg: "bg-red-100",
          text: "text-red-800",
          border: "border-red-200",
        },
        "perdido/roubado": {
          bg: "bg-red-100",
          text: "text-red-800",
          border: "border-red-200",
        },

        default: {
          bg: "bg-gray-100",
          text: "text-gray-800",
          border: "border-gray-200",
        },
      },
      position: {
        default: {
          bg: "bg-purple-100",
          text: "text-purple-800",
          border: "border-purple-200",
        },
      },
    };

    const configType = configs[type];
    const statusLower = statusName?.toLowerCase();

    // Encontra a configuração exata ou usa default
    return configType[statusLower] || configType.default;
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text} border ${config.border}`}
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
}) => (
  <div className="bg-white rounded-xl shadow-md p-6 mb-8">
    <h2 className="text-xl font-bold text-gray-800 mb-4">
      Adicionar Novo Pneu
    </h2>
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Caminhão */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Caminhão *
          </label>
          <select
            name="caminhao_id"
            value={form.caminhao_id}
            onChange={onCaminhaoChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="">Selecione o Caminhão</option>
            {caminhoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.placa} - KM: {c.km_atual?.toLocaleString("pt-BR")}
              </option>
            ))}
          </select>
        </div>

        {/* Posição */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Posição *
          </label>
          <select
            name="posicao_id"
            value={form.posicao_id}
            onChange={onChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="">Selecione a Posição</option>
            {posicoes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome_posicao}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status *
          </label>
          <select
            name="status_id"
            value={form.status_id}
            onChange={onChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="">Selecione o Status</option>
            {statusList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome_status}
              </option>
            ))}
          </select>
        </div>

        {/* Marca e Modelo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Marca *
          </label>
          <input
            type="text"
            name="marca"
            value={form.marca}
            onChange={onChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            required
            placeholder="Ex: Michelin, Bridgestone"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Modelo *
          </label>
          <input
            type="text"
            name="modelo"
            value={form.modelo}
            onChange={onChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            required
            placeholder="Ex: XZY-123"
          />
        </div>

        {/* Vida Útil */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vida Útil (KM)
          </label>
          <input
            type="number"
            name="vida_util_km"
            value={form.vida_util_km}
            onChange={onChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="Ex: 80000"
            min="0"
          />
        </div>

        {/* Data e KM Instalação */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Data de Instalação *
          </label>
          <input
            type="date"
            name="data_instalacao"
            value={form.data_instalacao}
            onChange={onChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            KM na Instalação
          </label>
          <input
            type="number"
            name="km_instalacao"
            value={form.km_instalacao || ""}
            onChange={onChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="KM atual do caminhão"
            min="0"
          />
        </div>
      </div>

      {/* Observação */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Observação
        </label>
        <textarea
          name="observacao"
          value={form.observacao}
          onChange={onChange}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          placeholder="Informações adicionais sobre o pneu..."
        />
      </div>

      {/* Botão Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {loading ? "Cadastrando..." : "Cadastrar Pneu"}
      </button>
    </form>
  </div>
);

const PneusTable = ({
  pneus,
  caminhoes,
  onDelete,
  loading,
  filtroPlaca,
  onFiltroChange,
}) => {
  // Cálculos para cada pneu
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

  // Filtro por placa
  const pneusFiltrados = useMemo(() => {
    if (!filtroPlaca.trim()) return pneusComCalculos;

    return pneusComCalculos.filter((pneu) =>
      pneu.caminhao?.placa?.toLowerCase().includes(filtroPlaca.toLowerCase())
    );
  }, [pneusComCalculos, filtroPlaca]);

  // ESTATÍSTICAS ATUALIZADAS COM TODOS OS STATUS
  const estatisticas = useMemo(() => {
    // Agrupar por categorias para melhor visualização
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

    // Contagem detalhada por status individual
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
    <div className="bg-white rounded-xl shadow-md p-6">
      {/* Header com Estatísticas e Filtro */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Pneus Cadastrados</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {estatisticas.total} pneus
            </span>
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              {estatisticas.emUso} em uso
            </span>
            <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
              {estatisticas.estoque} estoque
            </span>
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
              {estatisticas.manutencao} manutenção
            </span>
            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              {estatisticas.descarte} descarte
            </span>
          </div>

          {/* Detalhamento dos status (opcional - pode ser colapsável) */}
          <div className="mt-3 text-xs text-gray-600">
            <details>
              <summary className="cursor-pointer hover:text-gray-800">
                Ver detalhes por status
              </summary>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filtrar por placa:
          </label>
          <input
            type="text"
            placeholder="Digite a placa..."
            value={filtroPlaca}
            onChange={onFiltroChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      {pneusFiltrados.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🚛</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filtroPlaca ? "Nenhum pneu encontrado" : "Nenhum pneu cadastrado"}
          </h3>
          <p className="text-gray-600">
            {filtroPlaca
              ? `Não foram encontrados pneus para a placa "${filtroPlaca}"`
              : "Comece cadastrando o primeiro pneu no formulário acima."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
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
                    <div className="text-sm text-gray-500">
                      KM:{" "}
                      {pneu.caminhao?.km_atual?.toLocaleString("pt-BR") ||
                        "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {pneu.marca} {pneu.modelo}
                    </div>
                    <div className="text-sm text-gray-500">
                      Instalado:{" "}
                      {new Date(pneu.data_instalacao).toLocaleDateString(
                        "pt-BR"
                      )}
                    </div>
                    {pneu.observacao && (
                      <div className="text-sm text-gray-500 mt-1">
                        {pneu.observacao}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <StatusBadge
                        status={pneu.posicoes_pneus?.nome_posicao}
                        type="position"
                      />
                      <StatusBadge status={pneu.status_pneus?.nome_status} />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {pneu.kmRodado !== null ? (
                      <div className="text-sm text-gray-900">
                        {pneu.kmRodado.toLocaleString("pt-BR")} km
                      </div>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {pneu.percentualVidaUtil !== null ? (
                      <div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full ${
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
                        <div className="text-xs text-gray-500 mt-1">
                          {Math.round(pneu.percentualVidaUtil)}% restante
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/pneu/editar/${pneu.id}`}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => onDelete(pneu.id)}
                      className="text-red-600 hover:text-red-900"
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
    </div>
  );
};

const Pneus = () => {
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

  // Estado para filtro de placa
  const [filtroPlaca, setFiltroPlaca] = useState("");

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [caminhoesRes, posicoesRes, statusRes, pneusRes] =
        await Promise.all([
          axios.get(`${API_URL}/api/caminhoes`),
          axios.get(`${API_URL}/api/posicoes-pneus`),
          axios.get(`${API_URL}/api/status-pneus`),
          axios.get(`${API_URL}/api/pneus`),
        ]);

      setCaminhoes(caminhoesRes.data);
      setPosicoes(posicoesRes.data);
      setStatusList(statusRes.data);
      setPneus(pneusRes.data);
    } catch (err) {
      setError("Erro ao carregar dados. Verifique a conexão com o servidor.");
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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

      await axios.post(`${API_URL}/api/pneus`, dataToSend);

      // Recarregar dados
      await fetchData();

      // Reset form
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
      await axios.delete(`${API_URL}/api/pneus/${id}`);
      setPneus((prev) => prev.filter((p) => p.id !== id));
      setSuccessMessage("Pneu excluído com sucesso!");
    } catch (err) {
      setError("Erro ao excluir pneu.");
      console.error("Erro ao excluir pneu:", err);
    }
  };

  const handleFiltroChange = (e) => {
    setFiltroPlaca(e.target.value);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Controle de Pneus
          </h1>
          <p className="text-gray-600 text-lg">
            Gerencie a frota de pneus da sua transportadora
          </p>
        </div>

        {/* Mensagens de Feedback */}
        {error && <ErrorMessage message={error} onRetry={fetchData} />}
        {successMessage && <SuccessMessage message={successMessage} />}

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
