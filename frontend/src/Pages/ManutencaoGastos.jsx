import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApiMutation, useManutencaoGastosQueries } from "../hooks";
import { useToast } from "../components/ui/useToast.js";
import { API_CONFIG } from "../utils/constants.js";
import ConfirmModal from "../components/ConfirmModal";
import {
  Card,
  Button,
  LoadingSpinner,
  FormField,
  Alert,
  PageHeader,
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableTh,
  DataTableTd,
  TableRowActions,
} from "../components/ui";
import PageLayout from "../components/layout/PageLayout.jsx";
import EmptyState from "../components/EmptyState.jsx";

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

const DetalhesModal = ({ registro, onClose }) => {
  if (!registro) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <StatusBadge tipo={registro.tipo_registro} />
            Detalhes do Registro
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
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
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Caminhão
              </label>
              <p className="text-base font-semibold text-gray-900">
                {registro.placa || "N/A"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Data
              </label>
              <p className="text-base font-semibold text-gray-900">
                {registro.dataFormatada}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Valor
              </label>
              <p className="text-lg font-bold text-blue-600">
                {registro.valorFormatado}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                KM Registrado
              </label>
              <p className="text-base font-semibold text-gray-900">
                {registro.kmFormatado}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Tipo/Descrição
            </label>
            <p className="text-base font-semibold text-gray-900">
              {registro.nome_tipo || "N/A"}
            </p>
          </div>

          {registro.observacao && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Observações
              </label>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                  {registro.observacao}
                </p>
              </div>
            </div>
          )}

          {registro.oficina && registro.oficina !== "N/A" && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Oficina
              </label>
              <p className="text-base font-semibold text-gray-900">
                {registro.oficina}
              </p>
            </div>
          )}

          {registro.quantidade_combustivel && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">
                Quantidade de Combustível
              </label>
              <p className="text-base font-semibold text-gray-900">
                {registro.quantidade_combustivel} L
              </p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <Button onClick={onClose} className="w-full">
            Fechar
          </Button>
        </div>
      </div>
    </div>
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

  const caminhoesList = Array.isArray(caminhoes) ? caminhoes : [];

  const caminhaoSelecionado = caminhoesList.find(
    (c) => c.id === parseInt(form.caminhao_id, 10),
  );

  const caminhaoOptions = caminhoesList.map((c) => ({
    value: c.id,
    label: `${c.placa} - KM: ${c.km_atual?.toLocaleString("pt-BR")}`,
  }));

  const tipoOptions =
    form.tipo === "gasto"
      ? (Array.isArray(tiposGastos) ? tiposGastos : []).map((t) => ({
          value: t.id,
          label: t.nome_tipo,
        }))
      : (Array.isArray(itensChecklist) ? itensChecklist : []).map((i) => ({
          value: i.id,
          label: i.nome_item,
        }));

  return (
    <Card title="Adicionar Novo Registro" className="mb-8">
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5">
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
  onVerDetalhes,
  onEditar,
  filtroPlaca,
  onFiltroChange,
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
    const base = registrosFiltrados;
    const gastos = base.filter(
      (r) => r.tipo_registro === "Gasto" && r.valor !== "N/A",
    );
    const totalGastos = gastos.reduce((sum, g) => sum + parseFloat(g.valor), 0);
    const manutencoes = base.filter(
      (r) => r.tipo_registro === "Manutenção" && r.valor !== "N/A",
    );

    const totalValorManutencoes = manutencoes.reduce(
      (sum, m) => sum + parseFloat(m.valor),
      0,
    );
    return {
      totalGastos,
      totalValorManutencoes,
      totalRegistros: base.length,
    };
  }, [registrosFiltrados]);

  return (
    <Card className="overflow-hidden" noPadding>
      <div className="px-4 sm:px-5 py-4 border-b border-border flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-text-primary">
            Histórico de Registros
          </h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md text-xs font-medium border border-blue-100">
              {estatisticas.totalRegistros} registros
            </span>
            <span className="bg-green-50 text-green-700 px-2.5 py-0.5 rounded-md text-xs font-medium border border-green-100">
              {estatisticas.totalValorManutencoes.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}{" "}
              manutenções
            </span>
            <span className="bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-md text-xs font-medium border border-purple-100">
              {estatisticas.totalGastos.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}{" "}
              gastos
            </span>
          </div>
        </div>

        <div className="w-full xl:w-72 shrink-0">
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
        <div className="p-6">
          <EmptyState
            title={
              filtroPlaca
                ? "Nenhum registro encontrado"
                : "Nenhum registro cadastrado"
            }
            description={
              filtroPlaca
                ? `Não há registros para a placa "${filtroPlaca}".`
                : "Cadastre o primeiro registro no formulário acima."
            }
          />
        </div>
      ) : (
        <>
          <div className="md:hidden divide-y divide-border">
            {registrosFiltrados.map((registro) => (
              <div
                key={`${registro.tipo_registro}-${registro.id}-m`}
                className="px-4 py-3 flex gap-3 items-start"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tipo={registro.tipo_registro} />
                    <span className="font-semibold text-text-primary text-sm">
                      {registro.placa || "N/A"}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {registro.dataFormatada}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-text-primary line-clamp-1">
                    {registro.nome_tipo || "N/A"}
                  </p>
                  <div className="flex flex-wrap gap-x-3 text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">
                      {registro.valorFormatado}
                    </span>
                    <span>KM {registro.kmFormatado}</span>
                  </div>
                </div>
                <TableRowActions
                  onEdit={() => onEditar(registro)}
                  onView={() => onVerDetalhes(registro)}
                  onDelete={() =>
                    onDelete(registro.tipo_registro, registro.id)
                  }
                />
              </div>
            ))}
          </div>

          <DataTable className="hidden md:block">
            <DataTableHead>
              <tr>
                <DataTableTh width="9%">Tipo</DataTableTh>
                <DataTableTh width="8%">Caminhão</DataTableTh>
                <DataTableTh width="38%">Descrição</DataTableTh>
                <DataTableTh width="10%">Data</DataTableTh>
                <DataTableTh width="11%" align="right">
                  Valor
                </DataTableTh>
                <DataTableTh width="10%" align="right">
                  KM
                </DataTableTh>
                <DataTableTh width="14%" align="right">
                  Ações
                </DataTableTh>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {registrosFiltrados.map((registro) => {
                const subtexto = [
                  registro.observacao,
                  registro.oficina && registro.oficina !== "N/A"
                    ? `Oficina: ${registro.oficina}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <DataTableRow key={`${registro.tipo_registro}-${registro.id}`}>
                    <DataTableTd className="whitespace-nowrap">
                      <StatusBadge tipo={registro.tipo_registro} />
                    </DataTableTd>
                    <DataTableTd className="font-semibold whitespace-nowrap">
                      {registro.placa || "N/A"}
                    </DataTableTd>
                    <DataTableTd truncate title={subtexto || registro.nome_tipo}>
                      <div className="font-medium line-clamp-1">
                        {registro.nome_tipo || "N/A"}
                      </div>
                      {subtexto && (
                        <div className="text-xs text-text-secondary line-clamp-1 mt-0.5">
                          {subtexto}
                        </div>
                      )}
                    </DataTableTd>
                    <DataTableTd className="text-text-secondary whitespace-nowrap">
                      {registro.dataFormatada}
                    </DataTableTd>
                    <DataTableTd align="right" className="font-semibold whitespace-nowrap">
                      {registro.valorFormatado}
                    </DataTableTd>
                    <DataTableTd align="right" className="text-text-secondary whitespace-nowrap tabular-nums">
                      {registro.kmFormatado}
                    </DataTableTd>
                    <DataTableTd align="right">
                      <TableRowActions
                        onEdit={() => onEditar(registro)}
                        onView={() => onVerDetalhes(registro)}
                        onDelete={() =>
                          onDelete(registro.tipo_registro, registro.id)
                        }
                      />
                    </DataTableTd>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </>
      )}
    </Card>
  );
};

const ManutencaoGastos = () => {
  const navigate = useNavigate();
  const { post, put, delete: del } = useApiMutation();
  const toast = useToast();

  const {
    caminhoes,
    itensChecklist,
    tiposGastos,
    registros,
    listaTruncada,
    isLoading: loading,
    refetch,
  } = useManutencaoGastosQueries();

  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [registroSelecionado, setRegistroSelecionado] = useState(null);
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
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const ID_TIPO_GASTO_COMBUSTIVEL = 9;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCaminhaoChange = (e) => {
    const caminhaoId = e.target.value;
    const lista = Array.isArray(caminhoes) ? caminhoes : [];
    const caminhaoSelecionado = lista.find(
      (c) => c.id === parseInt(caminhaoId, 10),
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

    try {
      const caminhaoId = parseInt(form.caminhao_id, 10);
      const newKm = form.km_registro ? parseInt(form.km_registro, 10) : null;

      if (!Number.isFinite(caminhaoId) || caminhaoId <= 0) {
        throw new Error("Selecione um caminhão.");
      }
      if (!form.tipo_id) {
        throw new Error(
          form.tipo === "gasto"
            ? "Selecione o tipo de gasto."
            : "Selecione o item de manutenção.",
        );
      }
      if (!form.valor || Number.isNaN(parseFloat(String(form.valor).replace(",", ".")))) {
        throw new Error("Informe um valor válido.");
      }
      if (!form.data) {
        throw new Error("Informe a data.");
      }

      if (form.tipo === "gasto") {
        const tipoGastoId = parseInt(form.tipo_id, 10);
        if (!Number.isFinite(tipoGastoId) || tipoGastoId <= 0) {
          throw new Error("Selecione o tipo de gasto.");
        }
        const payload = {
          caminhao_id: caminhaoId,
          tipo_gasto_id: tipoGastoId,
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
        const itemId = parseInt(form.tipo_id, 10);
        if (!Number.isFinite(itemId) || itemId <= 0) {
          throw new Error("Selecione o item de manutenção.");
        }
        const payload = {
          caminhao_id: caminhaoId,
          item_id: itemId,
          data_manutencao: form.data,
          observacao: form.observacao,
          valor: parseFloat(String(form.valor).replace(",", ".")),
          oficina: form.oficina,
          km_manutencao: newKm,
        };
        await post("/checklist", payload);
      }

      // Atualizar KM do caminhão se necessário (rota por id)
      if (newKm !== null) {
        const caminhao = caminhoes.find((c) => c.id === caminhaoId);
        if (caminhao && newKm > caminhao.km_atual) {
          try {
            await put(`/caminhoes/id/${caminhaoId}`, {
              km_atual: newKm,
            });
          } catch (kmErr) {
            // Não bloquear o fluxo principal se a atualização de KM falhar
            console.warn("Não foi possível atualizar KM do caminhão:", kmErr);
          }
        }
      }

      await refetch();

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
    } catch (err) {
      console.error("Erro ao cadastrar registro:", err);
      if (!err?.response) {
        toast.error(err.message || "Não foi possível salvar o registro.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditar = (registro) => {
    if (registro.tipo_registro === "Manutenção") {
      navigate(`/checklist/editar/${registro.id}`);
      return;
    }
    navigate(`/gasto/editar/${registro.id}`);
  };

  const handleDeleteClick = (tipo, id) => {
    setDeleteTarget({ tipo, id });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    const { tipo, id } = deleteTarget;
    setDeleting(true);

    try {
      if (tipo === "Manutenção") {
        await del(`/checklist/${id}`);
      } else {
        await del(`/gastos/${id}`);
      }

      toast.success("Registro excluído com sucesso.");
      setDeleteTarget(null);
    } catch (err) {
      console.error("Erro completo:", err);
      if (!err?.response) {
        toast.error(err.message || "Não foi possível excluir o registro.");
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <PageLayout className="space-y-6">
      <PageHeader
        title="Manutenção e Gastos"
        subtitle="Controle completo de gastos e manutenções da frota"
      />

      {listaTruncada && (
        <Alert
          type="warning"
          message={`O histórico completo tem mais de ${API_CONFIG.LIST_MAX} registros. Exibindo os ${API_CONFIG.LIST_MAX} mais recentes de gastos e manutenções.`}
        />
      )}

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

      <HistoricoRegistros
        registros={registros}
        onDelete={handleDeleteClick}
        onEditar={handleEditar}
        onVerDetalhes={(registro) => setRegistroSelecionado(registro)}
        filtroPlaca={filtroPlaca}
        onFiltroChange={(e) => setFiltroPlaca(e.target.value)}
      />

      {registroSelecionado && (
        <DetalhesModal
          registro={registroSelecionado}
          onClose={() => setRegistroSelecionado(null)}
        />
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Excluir registro"
        message="Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita."
        confirmText={deleting ? "Excluindo..." : "Excluir"}
        cancelText="Cancelar"
        warning
      />
    </PageLayout>
  );
};

export default ManutencaoGastos;
