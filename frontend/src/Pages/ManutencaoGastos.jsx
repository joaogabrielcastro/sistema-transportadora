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

const StatusBadge = ({ tipo }) => {
  const config = {
    Gasto: {
      bg: "bg-blue-100",
      text: "text-blue-800",
      border: "border-blue-200",
    },
    Manutenção: {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-200",
    },
  }[tipo] || {
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text} border ${config.border}`}
    >
      {tipo}
    </span>
  );
};

const RegistroForm = ({
  form,
  caminhoes,
  itensChecklist,
  tiposGastos,
  onChange,
  onCaminhaoChange,
  onTipoChange,
  onSubmit,
  loading,
  ID_TIPO_GASTO_COMBUSTIVEL,
}) => {
  const isCombustivel =
    form.tipo === "gasto" &&
    parseInt(form.tipo_id) === ID_TIPO_GASTO_COMBUSTIVEL;
  const caminhaoSelecionado = caminhoes.find(
    (c) => c.id === parseInt(form.caminhao_id)
  );

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-8">
      <h2 className="text-xl font-bold text-gray-800 mb-6">
        Adicionar Novo Registro
      </h2>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Tipo de Registro */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Registro *
            </label>
            <select
              name="tipo"
              value={form.tipo}
              onChange={onTipoChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="gasto">Gasto Financeiro</option>
              <option value="manutencao">Manutenção (Checklist)</option>
            </select>
          </div>

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
            {caminhaoSelecionado && (
              <p className="text-sm text-gray-500 mt-1">
                KM atual:{" "}
                {caminhaoSelecionado.km_atual?.toLocaleString("pt-BR")}
              </p>
            )}
          </div>

          {/* Tipo de Gasto ou Item de Manutenção */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {form.tipo === "gasto"
                ? "Tipo de Gasto *"
                : "Item de Manutenção *"}
            </label>
            <select
              name="tipo_id"
              value={form.tipo_id}
              onChange={onChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="">Selecione...</option>
              {form.tipo === "gasto"
                ? tiposGastos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome_tipo}
                    </option>
                  ))
                : itensChecklist.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nome_item}
                    </option>
                  ))}
            </select>
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Valor (R$) *
            </label>
            <input
              type="number"
              name="valor"
              value={form.valor}
              onChange={onChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              step="0.01"
              min="0"
              required
              placeholder="0,00"
            />
          </div>

          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data *
            </label>
            <input
              type="date"
              name="data"
              value={form.data}
              onChange={onChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              required
              max={new Date().toISOString().split("T")[0]}
            />
          </div>

          {/* Quilometragem */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quilometragem (KM)
            </label>
            <input
              type="number"
              name="km_registro"
              value={form.km_registro}
              onChange={onChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              min="0"
              placeholder="KM atual do caminhão"
            />
          </div>

          {/* Oficina (apenas para manutenção) */}
          {form.tipo === "manutencao" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Oficina
              </label>
              <input
                type="text"
                name="oficina"
                value={form.oficina}
                onChange={onChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Nome da oficina"
              />
            </div>
          )}

          {/* Quantidade de Combustível */}
          {isCombustivel && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantidade (Litros) *
              </label>
              <input
                type="number"
                name="quantidade_combustivel"
                value={form.quantidade_combustivel}
                onChange={onChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                step="0.01"
                min="0"
                required
                placeholder="0,00"
              />
            </div>
          )}
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
            placeholder="Detalhes adicionais sobre o registro..."
          />
        </div>

        {/* Botão Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? "Cadastrando..." : "Cadastrar Registro"}
        </button>
      </form>
    </div>
  );
};

const HistoricoRegistros = ({
  registros,
  onDelete,
  filtroPlaca,
  onFiltroChange,
  loading,
}) => {
  const registrosFormatados = useMemo(() => {
    return registros.map((registro) => ({
      ...registro,
      valorFormatado:
        registro.valor !== "N/A"
          ? new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(registro.valor)
          : "N/A",
      dataFormatada: registro.data
        ? new Date(registro.data).toLocaleDateString("pt-BR")
        : "N/A",
      kmFormatado:
        registro.km_registro !== "N/A"
          ? parseInt(registro.km_registro).toLocaleString("pt-BR")
          : "N/A",
    }));
  }, [registros]);

  const registrosFiltrados = useMemo(() => {
    if (!filtroPlaca.trim()) return registrosFormatados;

    return registrosFormatados.filter((registro) =>
      registro.placa?.toLowerCase().includes(filtroPlaca.toLowerCase())
    );
  }, [registrosFormatados, filtroPlaca]);

  const estatisticas = useMemo(() => {
    const gastos = registrosFormatados.filter(
      (r) => r.tipo_registro === "Gasto" && r.valor !== "N/A"
    );
    const totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.valor), 0);
    const totalManutencoes = registrosFormatados.filter(
      (r) => r.tipo_registro === "Manutenção"
    ).length;

    return {
      totalGastos,
      totalManutencoes,
      totalRegistros: registrosFormatados.length,
    };
  }, [registrosFormatados]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      {/* Header com Estatísticas */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Histórico de Registros
          </h2>
          <div className="flex flex-wrap gap-4 mt-2">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {estatisticas.totalRegistros} registros
            </span>
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              {estatisticas.totalManutencoes} manutenções
            </span>
            <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
              {estatisticas.totalGastos.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}{" "}
              totalManutencoes
            </span>
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

      {/* Tabela */}
      {registrosFiltrados.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filtroPlaca
              ? "Nenhum registro encontrado"
              : "Nenhum registro cadastrado"}
          </h3>
          <p className="text-gray-600">
            {filtroPlaca
              ? `Não foram encontrados registros para a placa "${filtroPlaca}"`
              : "Comece cadastrando o primeiro registro no formulário acima."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Caminhão
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  KM
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {registrosFiltrados.map((registro) => (
                <tr
                  key={`${registro.tipo_registro}-${registro.id}`}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge tipo={registro.tipo_registro} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {registro.placa || "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {registro.nome_tipo || "N/A"}
                    </div>
                    {registro.observacao && (
                      <div className="text-sm text-gray-500 mt-1">
                        {registro.observacao}
                      </div>
                    )}
                    {registro.oficina && registro.oficina !== "N/A" && (
                      <div className="text-sm text-gray-500">
                        Oficina: {registro.oficina}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {registro.dataFormatada}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-semibold text-gray-900">
                      {registro.valorFormatado}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {registro.kmFormatado}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() =>
                        onDelete(registro.tipo_registro, registro.id)
                      }
                      className="text-red-600 hover:text-red-900 ml-4"
                      title="Excluir registro"
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

const ManutencaoGastos = () => {
  const [caminhoes, setCaminhoes] = useState([]);
  const [itensChecklist, setItensChecklist] = useState([]);
  const [tiposGastos, setTiposGastos] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [form, setForm] = useState({
    tipo: "gasto",
    caminhao_id: "",
    tipo_id: "",
    valor: "",
    data: new Date().toISOString().split("T")[0],
    observacao: "",
    oficina: "",
    km_registro: "",
    quantidade_combustivel: "",
  });
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const ID_TIPO_GASTO_MANUTENCAO = 10;
  const ID_TIPO_GASTO_COMBUSTIVEL = 9;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [caminhoesRes, itensRes, tiposRes, gastosRes, checklistRes] =
        await Promise.all([
          axios.get(`${API_URL}/api/caminhoes`),
          axios.get(`${API_URL}/api/itens-checklist`),
          axios.get(`${API_URL}/api/tipos-gastos`),
          axios.get(`${API_URL}/api/gastos`),
          axios.get(`${API_URL}/api/checklist`),
        ]);

      // Formatando dados
      const gastosFormatados = gastosRes.data.map((g) => ({
        ...g,
        tipo_registro: "Gasto",
        nome_tipo: g.tipos_gastos?.nome_tipo,
        placa: g.caminhoes?.placa,
        data: g.data_gasto,
        observacao: g.descricao,
        oficina: "N/A",
        km_registro: g.km_registro || "N/A",
        quantidade_combustivel: g.quantidade_combustivel || "N/A",
      }));

      const checklistFormatados = checklistRes.data.map((c) => ({
        ...c,
        tipo_registro: "Manutenção",
        nome_tipo: c.itens_checklist?.nome_item,
        placa: c.caminhoes?.placa,
        data: c.data_manutencao,
        valor: c.valor || "N/A", // ← Agora pega o valor real
        observacao: c.observacao,
        oficina: c.oficina || "N/A",
        km_registro: c.km_registro || "N/A", // ← Agora pega o KM real
        quantidade_combustivel: "N/A",
      }));

      setCaminhoes(caminhoesRes.data);
      setItensChecklist(itensRes.data);
      setTiposGastos(tiposRes.data);

      const todosRegistros = [...gastosFormatados, ...checklistFormatados].sort(
        (a, b) => new Date(b.data) - new Date(a.data)
      );

      setRegistros(todosRegistros);
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
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCaminhaoChange = (e) => {
    const caminhaoId = e.target.value;
    const caminhaoSelecionado = caminhoes.find(
      (c) => c.id === parseInt(caminhaoId)
    );

    setForm((prev) => ({
      ...prev,
      caminhao_id: caminhaoId,
      km_registro: caminhaoSelecionado?.km_atual || "",
    }));
  };

  const handleTipoChange = (e) => {
    const newTipo = e.target.value;
    setForm({
      tipo: newTipo,
      caminhao_id: form.caminhao_id,
      tipo_id: "",
      valor: "",
      data: form.data,
      observacao: "",
      oficina: "",
      km_registro: form.km_registro,
      quantidade_combustivel: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage("");

    try {
      const caminhaoId = parseInt(form.caminhao_id);
      const newKm = form.km_registro ? parseInt(form.km_registro, 10) : null;

      console.log("Dados sendo enviados:", {
        tipo: form.tipo,
        caminhao_id: caminhaoId,
        tipo_id: parseInt(form.tipo_id),
        valor: parseFloat(form.valor),
        data: form.data,
        observacao: form.observacao,
        oficina: form.oficina,
        km_registro: newKm,
        quantidade_combustivel: form.quantidade_combustivel
          ? parseFloat(form.quantidade_combustivel)
          : null,
      });

      if (form.tipo === "gasto") {
        const payload = {
          caminhao_id: caminhaoId,
          tipo_gasto_id: parseInt(form.tipo_id),

          valor: parseFloat(String(form.valor).replace(",", ".")),
          data_gasto: form.data,
          descricao: form.observacao,
          km_registro: newKm,
          quantidade_combustivel: form.quantidade_combustivel
            ? parseFloat(String(form.quantidade_combustivel).replace(",", "."))
            : null,
        };
        await axios.post(`${API_URL}/api/gastos`, payload);
      } else {
        const payload = {
          caminhao_id: caminhaoId,
          item_id: parseInt(form.tipo_id),
          data_manutencao: form.data,
          observacao: form.observacao,
          valor: parseFloat(String(form.valor).replace(",", ".")),
          oficina: form.oficina,
          km_registro: newKm,
        };
        console.log("Enviando para checklist:", payload);
        await axios.post(`${API_URL}/api/checklist`, payload);
      }

      // Atualizar KM do caminhão se necessário
      if (newKm !== null) {
        const caminhao = caminhoes.find((c) => c.id === caminhaoId);
        if (caminhao && newKm > caminhao.km_atual) {
          await axios.put(`${API_URL}/api/caminhoes/${caminhaoId}`, {
            km_atual: newKm,
          });
        }
      }

      // Recarregar dados
      await fetchData();

      // Resetar formulário
      setForm({
        tipo: "gasto",
        caminhao_id: "",
        tipo_id: "",
        valor: "",
        data: new Date().toISOString().split("T")[0],
        observacao: "",
        oficina: "",
        km_registro: "",
        quantidade_combustivel: "",
      });

      setSuccessMessage("Registro cadastrado com sucesso!");
    } catch (err) {
      setError(err.response?.data?.message || "Erro ao cadastrar registro.");
      console.error("Erro ao cadastrar registro:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tipo, id) => {
    if (!window.confirm("Tem certeza que deseja excluir este registro?"))
      return;

    try {
      if (tipo === "Manutenção") {
        await axios.delete(`${API_URL}/api/checklist/${id}`);
      } else {
        await axios.delete(`${API_URL}/api/gastos/${id}`);
      }

      setRegistros((prev) =>
        prev.filter((r) => !(r.id === id && r.tipo_registro === tipo))
      );
      setSuccessMessage("Registro excluído com sucesso!");
    } catch (err) {
      console.error("Erro completo:", err);
      console.error("Resposta do servidor:", err.response?.data);
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Erro ao cadastrar registro."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Manutenção e Gastos
          </h1>
          <p className="text-gray-600 text-lg">
            Controle completo de gastos e manutenções da frota
          </p>
        </div>

        {/* Mensagens de Feedback */}
        {error && <ErrorMessage message={error} onRetry={fetchData} />}
        {successMessage && <SuccessMessage message={successMessage} />}

        {/* Formulário */}
        <RegistroForm
          form={form}
          caminhoes={caminhoes}
          itensChecklist={itensChecklist}
          tiposGastos={tiposGastos}
          onChange={handleChange}
          onCaminhaoChange={handleCaminhaoChange}
          onTipoChange={handleTipoChange}
          onSubmit={handleSubmit}
          loading={submitting}
          ID_TIPO_GASTO_COMBUSTIVEL={ID_TIPO_GASTO_COMBUSTIVEL}
        />

        {/* Histórico */}
        <HistoricoRegistros
          registros={registros}
          onDelete={handleDelete}
          filtroPlaca={filtroPlaca}
          onFiltroChange={(e) => setFiltroPlaca(e.target.value)}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default ManutencaoGastos;
