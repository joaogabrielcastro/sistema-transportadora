import React, { useState, useMemo, useEffect } from "react";
import { useApiMutation, useManutencaoGastosQueries } from "../hooks";
import { useToast } from "../components/ui/useToast.js";
import ConfirmModal from "../components/ConfirmModal";
import RegistroDetailModal from "../components/RegistroDetailModal.jsx";
import RegistroEditModal from "../components/RegistroEditModal.jsx";
import Pagination from "../components/Pagination.jsx";
import { formatCaminhaoOptions } from "../utils/caminhaoOptions.js";
import {
  Card,
  Button,
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
  StatusBadge,
} from "../components/ui";
import PageLayout from "../components/layout/PageLayout.jsx";
import Breadcrumbs from "../components/layout/Breadcrumbs.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { TableSkeleton } from "../components/Skeleton.jsx";
import { isCombustivelTipo } from "../utils/tipoGastoUtils.js";
import { formatDate } from "../utils/formatters.js";
import { useAuth } from "../context/AuthContext.jsx";
import { apiFetch } from "../lib/apiClient.js";
import { extractApiArray } from "../utils/extractApiArray.js";
import { featureEnabled } from "../utils/billing.js";

/** Intervalo sugerido para óleo / lubrificação (km e meses). */
const OLEO_INTERVALO_KM = 10000;
const OLEO_INTERVALO_MESES = 6;

function isOleoOuLubrificacao(nome) {
  const n = String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /\boleo\b|\boléo\b|lubrific|graxa/.test(n) || n.includes("oleo");
}

function addMonthsYmd(ymd, months) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setMonth(d.getMonth() + months);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

const tipoToModal = (registro) => ({
  ...registro,
  tipo: registro.tipo_registro === "Manutenção" ? "manutencao" : "gasto",
});

const FormSection = ({ step, title, children }) => (
  <section className="rounded-lg border border-border bg-white p-4">
    <div className="mb-3 flex items-center gap-2">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
        {step}
      </span>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {children}
    </div>
  </section>
);

const RegistroForm = ({
  form,
  caminhoes,
  tiposGastos,
  produtosEstoque = [],
  showEstoque = false,
  onChange,
  onCaminhaoChange,
  onTipoChange,
  onSubmit,
  onSugerirProxima,
  loading,
}) => {
  const isManutencao = form.tipo === "manutencao";
  const isCombustivel =
    form.tipo === "gasto" && isCombustivelTipo(form.tipo_id, tiposGastos);

  const caminhoesList = Array.isArray(caminhoes) ? caminhoes : [];

  const caminhaoSelecionado = caminhoesList.find(
    (c) => c.id === parseInt(form.caminhao_id, 10),
  );

  const showLembreteOleo = isOleoOuLubrificacao(form.nome_item);

  const caminhaoOptions = formatCaminhaoOptions(caminhoesList, {
    includeKm: true,
  });

  const tipoGastoOptions = (Array.isArray(tiposGastos) ? tiposGastos : []).map(
    (t) => ({
      value: t.id,
      label: t.nome_tipo,
    }),
  );

  const produtoOptions = (Array.isArray(produtosEstoque) ? produtosEstoque : [])
    .filter((p) => Number(p.saldo) > 0)
    .map((p) => ({
      value: String(p.id),
      label: `${p.descricao} — saldo ${Number(p.saldo)} ${p.unidade || ""}`,
      searchText: [p.codigo, p.descricao].filter(Boolean).join(" "),
    }));

  const produtoSelecionado = produtosEstoque.find(
    (p) => String(p.id) === String(form.produto_id),
  );

  const campoTipo = (
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
      className="mb-0"
    />
  );

  const campoCaminhao = (
    <FormField
      label="Caminhão"
      type="typeahead"
      name="caminhao_id"
      value={form.caminhao_id}
      onChange={onCaminhaoChange}
      required
      placeholder="Digite placa, modelo ou tipo..."
      options={caminhaoOptions}
      helperText={
        caminhaoSelecionado
          ? `KM atual: ${caminhaoSelecionado.km_atual?.toLocaleString("pt-BR")}`
          : ""
      }
      className="mb-0"
    />
  );

  const campoKm = (
    <FormField
      label="Quilometragem (KM)"
      type="number"
      name="km_registro"
      value={form.km_registro}
      onChange={onChange}
      min="0"
      placeholder="KM atual do caminhão"
      className="mb-0"
    />
  );

  const campoData = (
    <FormField
      label="Data"
      type="date"
      name="data"
      value={form.data}
      onChange={onChange}
      required
      max={new Date().toISOString().split("T")[0]}
      className="mb-0"
    />
  );

  const campoValor = (
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
      className="mb-0"
    />
  );

  return (
    <Card title="Adicionar Novo Registro" className="mb-8">
      <form onSubmit={onSubmit} className="space-y-4">
        {isManutencao ? (
          <>
            <FormSection step={1} title="Caminhão, KM e data">
              {campoTipo}
              {campoCaminhao}
              {campoKm}
              {campoData}
            </FormSection>

            <FormSection step={2} title="Serviço e oficina">
              <FormField
                label="Serviço realizado"
                type="text"
                name="nome_item"
                value={form.nome_item}
                onChange={onChange}
                required
                placeholder="Ex.: Troca de óleo, filtros, pastilhas..."
                className="mb-0 sm:col-span-2"
              />
              <FormField
                label="Oficina"
                name="oficina"
                value={form.oficina}
                onChange={onChange}
                placeholder="Nome da oficina"
                className="mb-0"
              />
            </FormSection>

            <FormSection step={3} title="Valor">
              {campoValor}
            </FormSection>

            <section className="rounded-lg border border-border bg-slate-50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
                    4
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      Próxima manutenção e observações
                    </h3>
                    <p className="text-xs text-text-light">
                      {showLembreteOleo
                        ? `Detectamos óleo/lubrificação — sugestão: +${OLEO_INTERVALO_KM.toLocaleString("pt-BR")} km ou +${OLEO_INTERVALO_MESES} meses`
                        : "Opcional. Quando chegar perto do KM ou da data, aparece em Alertas."}
                    </p>
                  </div>
                </div>
                {onSugerirProxima && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onSugerirProxima}
                  >
                    Sugerir próxima troca
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Próxima troca (KM)"
                  type="number"
                  name="proxima_km"
                  value={form.proxima_km ?? ""}
                  onChange={onChange}
                  min="0"
                  placeholder="Ex.: 1400000"
                  className="mb-0"
                />
                <FormField
                  label="Próxima troca (data)"
                  type="date"
                  name="proxima_data"
                  value={form.proxima_data ?? ""}
                  onChange={onChange}
                  className="mb-0"
                />
                <FormField
                  label="Observação"
                  type="textarea"
                  name="observacao"
                  value={form.observacao}
                  onChange={onChange}
                  rows={3}
                  placeholder="Detalhes adicionais sobre o registro..."
                  className="mb-0 sm:col-span-2"
                />
              </div>
            </section>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {campoTipo}
            {campoCaminhao}
            <FormField
              label="Tipo de Gasto"
              type="select"
              name="tipo_id"
              value={form.tipo_id}
              onChange={onChange}
              required
              options={tipoGastoOptions}
              className="mb-0"
            />
            {campoValor}
            {campoData}
            {campoKm}
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
                className="mb-0"
              />
            )}
            {showEstoque && produtoOptions.length > 0 && (
              <>
                <FormField
                  label="Usar do estoque (opcional)"
                  type="typeahead"
                  name="produto_id"
                  value={form.produto_id || ""}
                  onChange={onChange}
                  options={produtoOptions}
                  allowEmpty
                  emptyLabel="Não usar estoque"
                  placeholder="Peça importada na NF-e…"
                  helperText="Dá baixa automática no estoque ao cadastrar o gasto."
                  className="mb-0 sm:col-span-2"
                />
                {form.produto_id && (
                  <FormField
                    label="Qtd. do estoque"
                    type="number"
                    name="quantidade_estoque"
                    value={form.quantidade_estoque || "1"}
                    onChange={onChange}
                    step="0.001"
                    min="0.001"
                    required
                    helperText={
                      produtoSelecionado
                        ? `Saldo: ${Number(produtoSelecionado.saldo)} ${produtoSelecionado.unidade || ""}`
                        : ""
                    }
                    className="mb-0"
                  />
                )}
              </>
            )}
            <FormField
              label="Observação"
              type="textarea"
              name="observacao"
              value={form.observacao}
              onChange={onChange}
              rows={3}
              placeholder="Detalhes adicionais sobre o registro..."
              className="mb-0 sm:col-span-2 lg:col-span-3 xl:col-span-4"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
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
  pagination,
  onPageChange,
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
      dataFormatada: registro.data ? formatDate(registro.data) : "N/A",
      kmFormatado:
        registro.km_registro !== "N/A" && !isNaN(parseInt(registro.km_registro))
          ? parseInt(registro.km_registro).toLocaleString("pt-BR")
          : "N/A",
    }));
  }, [registros]);

  const estatisticas = useMemo(() => {
    const base = registrosFormatados;
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
  }, [registrosFormatados]);

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
            label="Filtrar por placa"
            name="filtro_placa"
            placeholder="Ex.: ABC1D23"
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

      {registrosFormatados.length === 0 ? (
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
            {registrosFormatados.map((registro) => (
              <div
                key={`${registro.tipo_registro}-${registro.id}-m`}
                className="px-4 py-3 flex gap-3 items-start"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={registro.tipo_registro}
                      type="record"
                    />
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
              {registrosFormatados.map((registro) => {
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
                      <StatusBadge
                      status={registro.tipo_registro}
                      type="record"
                    />
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
          {pagination && pagination.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border">
              <Pagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                onPageChange={onPageChange}
              />
            </div>
          )}
        </>
      )}
    </Card>
  );
};

const ManutencaoGastos = () => {
  const { post, delete: del } = useApiMutation();
  const toast = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [debouncedPlaca, setDebouncedPlaca] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPlaca(filtroPlaca), 350);
    return () => clearTimeout(timer);
  }, [filtroPlaca]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedPlaca]);

  const {
    caminhoes,
    tiposGastos,
    registros,
    pagination,
    isLoading: loading,
    refetch,
  } = useManutencaoGastosQueries({
    page: currentPage,
    limit: 20,
    placa: debouncedPlaca,
  });

  const [registroSelecionado, setRegistroSelecionado] = useState(null);
  const [registroEmEdicao, setRegistroEmEdicao] = useState(null);
  const [form, setForm] = useState({
    tipo: "gasto",
    caminhao_id: "",
    tipo_id: "",
    nome_item: "",
    valor: "",
    data: new Date().toISOString().split("T")[0],
    observacao: "",
    oficina: "",
    km_registro: "",
    quantidade_combustivel: "",
    proxima_km: "",
    proxima_data: "",
    produto_id: "",
    quantidade_estoque: "1",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [produtosEstoque, setProdutosEstoque] = useState([]);
  const { user } = useAuth();
  const showEstoque = featureEnabled(user, "notas_estoque");

  useEffect(() => {
    if (!showEstoque) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch({
          url: "/notas-fiscais/produtos?limit=200",
        });
        if (!cancelled) setProdutosEstoque(extractApiArray(res));
      } catch {
        if (!cancelled) setProdutosEstoque([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showEstoque]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (
        name === "nome_item" &&
        isOleoOuLubrificacao(value) &&
        !prev.proxima_km &&
        !prev.proxima_data
      ) {
        const kmAtual = prev.km_registro
          ? parseInt(prev.km_registro, 10)
          : null;
        if (Number.isFinite(kmAtual) && kmAtual > 0) {
          next.proxima_km = String(kmAtual + OLEO_INTERVALO_KM);
        }
        next.proxima_data =
          addMonthsYmd(prev.data, OLEO_INTERVALO_MESES) || prev.proxima_data;
      }
      return next;
    });
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
      nome_item: "",
      valor: "",
      data: form.data,
      observacao: "",
      oficina: "",
      km_registro: form.km_registro,
      quantidade_combustivel: "",
      proxima_km: "",
      proxima_data: "",
      produto_id: "",
      quantidade_estoque: "1",
    });
  };

  const handleSugerirProxima = () => {
    const kmAtual = form.km_registro
      ? parseInt(form.km_registro, 10)
      : null;
    setForm((prev) => ({
      ...prev,
      proxima_km:
        Number.isFinite(kmAtual) && kmAtual > 0
          ? String(kmAtual + OLEO_INTERVALO_KM)
          : prev.proxima_km,
      proxima_data:
        addMonthsYmd(prev.data, OLEO_INTERVALO_MESES) || prev.proxima_data,
    }));
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
      if (form.tipo === "gasto" && !form.tipo_id) {
        throw new Error("Selecione o tipo de gasto.");
      }
      if (form.tipo === "manutencao" && !String(form.nome_item || "").trim()) {
        throw new Error("Informe o item de manutenção.");
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
        if (form.produto_id) {
          payload.produto_id = parseInt(form.produto_id, 10);
          payload.quantidade_estoque = form.quantidade_estoque
            ? parseFloat(String(form.quantidade_estoque).replace(",", "."))
            : 1;
        }
        await post("/gastos", payload, { skipSuccessToast: true });
      } else {
        const payload = {
          caminhao_id: caminhaoId,
          nome_item: String(form.nome_item).trim(),
          data_manutencao: form.data,
          observacao: form.observacao,
          valor: parseFloat(String(form.valor).replace(",", ".")),
          oficina: form.oficina,
          km_manutencao: newKm,
          proxima_km: form.proxima_km
            ? parseInt(form.proxima_km, 10)
            : null,
          proxima_data: form.proxima_data || null,
        };
        await post("/checklist", payload, { skipSuccessToast: true });
      }

      await refetch();
      toast.success("Registro cadastrado com sucesso.");

      // Resetar formulário
      setForm({
        tipo: "gasto",
        caminhao_id: "",
        tipo_id: "",
        nome_item: "",
        valor: "",
        data: new Date().toISOString().split("T")[0],
        observacao: "",
        oficina: "",
        km_registro: "",
        quantidade_combustivel: "",
        proxima_km: "",
        proxima_data: "",
        produto_id: "",
        quantidade_estoque: "1",
      });
      if (showEstoque) {
        try {
          const res = await apiFetch({
            url: "/notas-fiscais/produtos?limit=200",
          });
          setProdutosEstoque(extractApiArray(res));
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.error("Erro ao cadastrar registro:", err);
      toast.error(err.message || "Não foi possível salvar o registro.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditar = (registro) => {
    setRegistroEmEdicao(registro);
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
        await del(`/checklist/${id}`, { skipSuccessToast: true });
      } else {
        await del(`/gastos/${id}`, { skipSuccessToast: true });
      }

      toast.success("Registro excluído com sucesso.");
      await refetch();
      setDeleteTarget(null);
    } catch (err) {
      console.error("Erro completo:", err);
      toast.error(err.message || "Não foi possível excluir o registro.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <PageLayout className="space-y-6">
        <PageHeader
          title="Manutenção e Gastos"
          subtitle="Controle completo de gastos e manutenções da frota"
        />
        <Card>
          <TableSkeleton rows={8} columns={5} />
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Início", to: "/" }, { label: "Manutenção e gastos" }]}
      />
      <PageHeader
        title="Manutenção e Gastos"
        subtitle="Controle completo de gastos e manutenções da frota"
      />

      {pagination && pagination.totalItems > 0 && (
        <p className="text-sm text-text-secondary">
          {pagination.totalItems.toLocaleString("pt-BR")} registros no total
          {pagination.totalPages > 1
            ? ` · página ${pagination.currentPage} de ${pagination.totalPages}`
            : ""}
        </p>
      )}

      <RegistroForm
          form={form}
          caminhoes={caminhoes}
          tiposGastos={tiposGastos}
          produtosEstoque={produtosEstoque}
          showEstoque={showEstoque}
          onChange={handleChange}
          onCaminhaoChange={handleCaminhaoChange}
          onTipoChange={handleTipoChange}
          onSugerirProxima={handleSugerirProxima}
          onSubmit={handleSubmit}
          loading={submitting}
        />

      <HistoricoRegistros
        registros={registros}
        onDelete={handleDeleteClick}
        onEditar={handleEditar}
        onVerDetalhes={(registro) => setRegistroSelecionado(registro)}
        filtroPlaca={filtroPlaca}
        onFiltroChange={(e) => setFiltroPlaca(e.target.value)}
        pagination={pagination}
        onPageChange={setCurrentPage}
      />

      {registroEmEdicao && (
        <RegistroEditModal
          registro={registroEmEdicao}
          tiposGastos={tiposGastos}
          onClose={() => setRegistroEmEdicao(null)}
          onSaved={async () => {
            toast.success("Registro atualizado com sucesso.");
            await refetch();
          }}
        />
      )}

      {registroSelecionado && (
        <RegistroDetailModal
          registro={tipoToModal(registroSelecionado)}
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
