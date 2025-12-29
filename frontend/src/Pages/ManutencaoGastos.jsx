import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import {
  Card,
  Button,
  Alert,
  LoadingSpinner,
  FormField,
} from "../components/ui";

const StatusBadge = ({ tipo }) => {
  const config =
    {
      Gasto: "bg-blue-100 text-blue-800 border-blue-200",
      Manutenção: "bg-green-100 text-green-800 border-green-200",
    }[tipo] || "bg-gray-100 text-gray-800 border-gray-200";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config}`}
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

  const caminhaoOptions = caminhoes.map((c) => ({
    value: c.id,
    label: `${c.placa} - KM: ${c.km_atual?.toLocaleString("pt-BR")}`,
  }));

  const tipoOptions =
    form.tipo === "gasto"
      ? tiposGastos.map((t) => ({ value: t.id, label: t.nome_tipo }))
      : itensChecklist.map((i) => ({ value: i.id, label: i.nome_item }));

  return (
    <Card title="Adicionar Novo Registro" className="mb-8">
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FormField
            label="Tipo de Registro"
            type="select"
            name="tipo"
            value={form.tipo}
            onChange={onTipoChange}
            required
            options={[
              { value: "gasto", label: "Gasto Financeiro" },
              { value: "manutencao", label: "Manutenção (Checklist)" },
            ]}
          />

          <FormField
            label="Caminhão"
            type="select"
            name="caminhao_id"
            value={form.caminhao_id}
            onChange={onCaminhaoChange}
            required
            options={caminhaoOptions}
            helperText={
              caminhaoSelecionado
                ? `KM atual: ${caminhaoSelecionado.km_atual?.toLocaleString(
                    "pt-BR"
                  )}`
                : ""
            }
          />

          <FormField
            label={
              form.tipo === "gasto" ? "Tipo de Gasto" : "Item de Manutenção"
            }
            type="select"
            name="tipo_id"
            value={form.tipo_id}
            onChange={onChange}
            required
            options={tipoOptions}
          />

          <FormField
            label="Valor (R$)"
            type="number"
            name="valor"
            value={form.valor}
            onChange={onChange}
            step="0.01"
            min="0"
            required
            placeholder="0,00"
            icon={<span className="text-gray-500 font-semibold">R$</span>}
          />

          <FormField
            label="Data"
            type="date"
            name="data"
            value={form.data}
            onChange={onChange}
            required
            max={new Date().toISOString().split("T")[0]}
          />

          <FormField
            label="Quilometragem (KM)"
            type="number"
            name="km_registro"
            value={form.km_registro}
            onChange={onChange}
            min="0"
            placeholder="KM atual do caminhão"
          />

          {form.tipo === "manutencao" && (
            <FormField
              label="Oficina"
              name="oficina"
              value={form.oficina}
              onChange={onChange}
              placeholder="Nome da oficina"
            />
          )}

          {isCombustivel && (
            <FormField
              label="Quantidade (Litros)"
              type="number"
              name="quantidade_combustivel"
              value={form.quantidade_combustivel}
              onChange={onChange}
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
          name="observacao"
          value={form.observacao}
          onChange={onChange}
          rows={3}
          placeholder="Detalhes adicionais sobre o registro..."
        />

        <div className="flex justify-end mt-4">
          <Button type="submit" loading={loading}>
            Cadastrar Registro
          </Button>
        </div>
      </form>
    </Card>
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
        registro.km_registro !== "N/A" && !isNaN(parseInt(registro.km_registro))
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
    const manutencoes = registrosFormatados.filter(
      (r) => r.tipo_registro === "Manutenção" && r.valor !== "N/A"
    );

    const totalValorManutencoes = manutencoes.reduce(
      (sum, m) => sum + parseFloat(m.valor),
      0
    );
    return {
      totalGastos,
      totalValorManutencoes,
      totalRegistros: registrosFormatados.length,
    };
  }, [registrosFormatados]);

  if (loading) return <LoadingSpinner />;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Histórico de Registros
          </h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100">
              {estatisticas.totalRegistros} registros
            </span>
            <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium border border-green-100">
              {estatisticas.totalValorManutencoes.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}{" "}
              em Manutenções
            </span>
            <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-medium border border-purple-100">
              {estatisticas.totalGastos.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}{" "}
              em Gastos
            </span>
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

      {registrosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <div className="text-4xl mb-3 opacity-50">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {filtroPlaca
              ? "Nenhum registro encontrado"
              : "Nenhum registro cadastrado"}
          </h3>
          <p className="text-gray-500 text-sm">
            {filtroPlaca
              ? `Não foram encontrados registros para a placa "${filtroPlaca}"`
              : "Comece cadastrando o primeiro registro no formulário acima."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6">
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {registro.placa || "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 font-medium">
                      {registro.nome_tipo || "N/A"}
                    </div>
                    {registro.observacao && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                        {registro.observacao}
                      </div>
                    )}
                    {registro.oficina && registro.oficina !== "N/A" && (
                      <div className="text-xs text-gray-500 mt-0.5">
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
                      className="text-red-600 hover:text-red-900 transition-colors text-xs font-medium uppercase tracking-wide"
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

const ManutencaoGastos = () => {
  const { get, post, put, delete: del } = useApi();
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
          get("/caminhoes"),
          get("/itens-checklist"),
          get("/tipos-gastos"),
          get("/gastos"),
          get("/checklist"),
        ]);

      const extractArray = (res) => {
        if (Array.isArray(res)) return res;
        if (res?.data && Array.isArray(res.data)) return res.data;
        if (res?.data?.data && Array.isArray(res.data.data))
          return res.data.data;
        return [];
      };

      const caminhoesData = extractArray(caminhoesRes);
      const itensData = extractArray(itensRes);
      const tiposData = extractArray(tiposRes);
      const gastosData = extractArray(gastosRes);
      const checklistData = extractArray(checklistRes);

      // Formatando dados
      const gastosFormatados = (
        Array.isArray(gastosData) ? gastosData : []
      ).map((g) => ({
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

      const checklistFormatados = (
        Array.isArray(checklistData) ? checklistData : []
      ).map((c) => ({
        ...c,
        tipo_registro: "Manutenção",
        nome_tipo: c.itens_checklist?.nome_item,
        placa: c.caminhoes?.placa,
        data: c.data_manutencao,
        valor: c.valor || "N/A",
        observacao: c.observacao,
        oficina: c.oficina || "N/A",
        km_registro: c.km_manutencao || "N/A",
        quantidade_combustivel: "N/A",
      }));

      setCaminhoes(caminhoesData);
      setItensChecklist(itensData);
      setTiposGastos(tiposData);

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
  }, [get]);

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
        await post("/gastos", payload);
      } else {
        const payload = {
          caminhao_id: caminhaoId,
          item_id: parseInt(form.tipo_id),
          data_manutencao: form.data,
          observacao: form.observacao,
          valor: parseFloat(String(form.valor).replace(",", ".")),
          oficina: form.oficina,
          km_manutencao: newKm,
        };
        await post("/checklist", payload);
      }

      // Atualizar KM do caminhão se necessário
      if (newKm !== null) {
        const caminhao = caminhoes.find((c) => c.id === caminhaoId);
        if (caminhao && newKm > caminhao.km_atual) {
          await put(`/caminhoes/${caminhaoId}`, {
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
      setTimeout(() => setSuccessMessage(""), 5000);
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
        await del(`/checklist/${id}`);
      } else {
        await del(`/gastos/${id}`);
      }

      setRegistros((prev) =>
        prev.filter((r) => !(r.id === id && r.tipo_registro === tipo))
      );
      setSuccessMessage("Registro excluído com sucesso!");
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      console.error("Erro completo:", err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Erro ao excluir registro."
      );
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-4 md:px-8">
      <div className="max-w-7xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Manutenção e Gastos
          </h1>
          <p className="text-text-secondary text-lg">
            Controle completo de gastos e manutenções da frota
          </p>
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
