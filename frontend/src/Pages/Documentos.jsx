import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout.jsx";
import {
  Alert, Button, Card, DataTable, DataTableBody, DataTableHead,
  DataTableRow, DataTableTd, DataTableTh, PageHeader, StatusBadge,
} from "../components/ui";
import EmptyState from "../components/EmptyState.jsx";
import Icon from "../components/ui/Icon.jsx";
import { TableSkeleton } from "../components/Skeleton.jsx";
import { apiFetch, parseApiError } from "../lib/apiClient.js";
import { formatDate } from "../utils/formatters.js";

const STATUS_LABEL = {
  vencido: "Vencido",
  critico: "≤ 7 dias",
  atencao: "≤ 30 dias",
  ok: "Em dia",
  sem_validade: "Sem validade",
};

const FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "vencido", label: "Vencidos" },
  { id: "critico", label: "Críticos" },
  { id: "atencao", label: "Atenção" },
  { id: "sem_validade", label: "Sem validade" },
];

/** "vence em 12 dias" / "vencido há 3 dias" a partir da data de validade. */
function prazoLabel(validade) {
  const m = String(validade || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const alvo = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((alvo - hoje) / 86_400_000);
  if (dias < 0) return `vencido há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`;
  if (dias === 0) return "vence hoje";
  if (dias <= 60) return `vence em ${dias} dia${dias === 1 ? "" : "s"}`;
  return "";
}

export default function Documentos() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("todos");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch({ url: "/ops/documentos" });
      setData(res.data);
    } catch (err) {
      const parsed = await parseApiError(err);
      setError(parsed.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const items = useMemo(() => {
    const list = data?.items || [];
    if (filter === "todos") return list;
    return list.filter((i) => i.status === filter);
  }, [data, filter]);

  const summary = data?.summary;
  const countFor = (id) => {
    if (!data?.items) return null;
    if (id === "todos") return data.items.length;
    return data.items.filter((i) => i.status === id).length;
  };

  const kpis = [
    { id: "vencido", title: "Vencidos", value: summary?.vencidos, tone: "red", hint: "Regularize imediatamente", icon: "alert" },
    { id: "critico", title: "Vencem em 7 dias", value: summary?.criticos, tone: "orange", hint: "Prioridade da semana", icon: "clock" },
    { id: "atencao", title: "Vencem em 30 dias", value: summary?.atencao, tone: "amber", hint: "Programe a renovação", icon: "calendar" },
    { id: "todos", title: "Total de documentos", value: summary?.total, tone: "slate", hint: "Anexados aos veículos", icon: "document" },
  ];

  return (
    <PageLayout>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Frota"
          title="Documentos da frota"
          subtitle="Vencimentos de CRLV, ANTT, seguro e outros documentos. Anexe os PDFs no detalhe de cada veículo."
          actions={
            <Link to="/frota">
              <Button variant="outline" icon={<Icon name="truck" className="h-4 w-4" />}>
                Anexar em um veículo
              </Button>
            </Link>
          }
        />
        {error && (
          <Alert type="error" title="Não foi possível carregar os documentos">
            {error}
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={load}>
                Tentar novamente
              </Button>
            </div>
          </Alert>
        )}

        {summary && (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {kpis.map((k) => {
              const active = filter === k.id;
              const value = Number(k.value || 0);
              const alerting = k.id !== "todos" && value > 0;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setFilter(k.id)}
                  aria-pressed={active}
                  className={`card group p-4 text-left transition-[border-color,box-shadow] hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                    active ? "!border-primary ring-1 ring-primary" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-text-secondary">{k.title}</span>
                    <Icon
                      name={k.icon}
                      className={`h-4 w-4 ${
                        alerting
                          ? k.tone === "red"
                            ? "text-red-600"
                            : k.tone === "orange"
                              ? "text-orange-600"
                              : "text-amber-600"
                          : "text-text-light"
                      }`}
                    />
                  </div>
                  <p
                    className={`mt-1 text-2xl font-semibold tabular-nums ${
                      alerting && k.tone === "red" ? "text-red-700" : "text-text-primary"
                    }`}
                  >
                    {value}
                  </p>
                  <p className="mt-1 truncate text-xs text-text-secondary">{k.hint}</p>
                </button>
              );
            })}
          </div>
        )}

        <Card noPadding className="overflow-hidden">
          <div className="scrollbar-thin flex gap-1.5 overflow-x-auto border-b border-border p-3 sm:p-4" role="group" aria-label="Filtrar documentos">
            {FILTERS.map((f) => {
              const n = countFor(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={`chip shrink-0 ${filter === f.id ? "chip-active" : ""}`}
                >
                  {f.label}
                  {n != null ? <span className="tabular-nums opacity-70">{n}</span> : null}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="p-4">
              <TableSkeleton rows={5} columns={5} />
            </div>
          ) : error ? null : items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<Icon name="document" className="h-5 w-5" />}
                title={
                  filter === "todos"
                    ? "Você ainda não possui documentos cadastrados."
                    : "Nenhum documento neste filtro"
                }
                description={
                  filter === "todos"
                    ? "Anexe PDFs no detalhe do caminhão e informe a data de validade para receber alertas de vencimento."
                    : "Ótimo sinal: nada nesta situação agora."
                }
                dashed
                action={
                  filter === "todos" ? (
                    <Link to="/frota">
                      <Button>Ir para a frota</Button>
                    </Link>
                  ) : (
                    <Button variant="outline" onClick={() => setFilter("todos")}>
                      Ver todos
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border sm:hidden">
                {items.map((doc) => (
                  <li key={doc.id} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-text-primary">{doc.nome_original}</p>
                        <p className="mt-0.5 text-xs text-text-secondary">{doc.tipo_documento || "Tipo não informado"}</p>
                      </div>
                      <StatusBadge status={STATUS_LABEL[doc.status] || doc.status} />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      {doc.placa ? (
                        <Link to={`/caminhao/${doc.placa}`} className="plate">
                          {doc.placa}
                        </Link>
                      ) : <span>—</span>}
                      <span className="whitespace-nowrap text-xs text-text-secondary">
                        {formatDate(doc.validade_em) || "Sem validade"}
                        {prazoLabel(doc.validade_em) ? ` · ${prazoLabel(doc.validade_em)}` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden sm:block">
                <DataTable fixed={false}>
                  <DataTableHead>
                    <tr>
                      <DataTableTh>Veículo</DataTableTh>
                      <DataTableTh>Documento</DataTableTh>
                      <DataTableTh>Tipo</DataTableTh>
                      <DataTableTh>Validade</DataTableTh>
                      <DataTableTh>Situação</DataTableTh>
                      <DataTableTh align="right"><span className="sr-only">Ações</span></DataTableTh>
                    </tr>
                  </DataTableHead>
                  <DataTableBody>
                    {items.map((doc) => (
                      <DataTableRow key={doc.id}>
                        <DataTableTd>
                          {doc.placa ? (
                            <Link to={`/caminhao/${doc.placa}`} className="plate hover:border-secondary">
                              {doc.placa}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </DataTableTd>
                        <DataTableTd className="font-medium">{doc.nome_original}</DataTableTd>
                        <DataTableTd>{doc.tipo_documento || <span className="text-text-light">—</span>}</DataTableTd>
                        <DataTableTd className="whitespace-nowrap">
                          <span className="tabular-nums">{formatDate(doc.validade_em) || "—"}</span>
                          {prazoLabel(doc.validade_em) ? (
                            <span className="block text-xs text-text-secondary">{prazoLabel(doc.validade_em)}</span>
                          ) : null}
                        </DataTableTd>
                        <DataTableTd><StatusBadge status={STATUS_LABEL[doc.status] || doc.status} dot /></DataTableTd>
                        <DataTableTd align="right">
                          {doc.placa ? (
                            <Link
                              to={`/caminhao/${doc.placa}?aba=documentos`}
                              className="inline-flex items-center gap-1 rounded text-[13px] font-semibold text-secondary-dark hover:text-secondary"
                            >
                              Abrir <Icon name="chevronRight" className="h-3.5 w-3.5" />
                            </Link>
                          ) : null}
                        </DataTableTd>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </div>
            </>
          )}
        </Card>
      </div>
    </PageLayout>
  );
}
