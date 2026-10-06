import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout.jsx";
import {
  Alert, Button, Card, DataTable, DataTableBody, DataTableHead,
  DataTableRow, DataTableTd, DataTableTh, PageHeader, StatCard, StatusBadge,
} from "../components/ui";
import EmptyState from "../components/EmptyState.jsx";
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

  return (
    <PageLayout>
      <div className="space-y-6">
        <PageHeader
          title="Documentos da frota"
          subtitle="Vencimentos de CRLV, ANTT, seguro e outros documentos dos caminhões."
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

        {data?.summary && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total" value={data.summary.total} />
            <StatCard title="Vencidos" value={data.summary.vencidos} />
            <StatCard title="Críticos" value={data.summary.criticos} />
            <StatCard title="Atenção" value={data.summary.atencao} />
          </div>
        )}

        <div className="flex flex-wrap gap-2" aria-label="Filtrar documentos">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                filter === f.id
                  ? "bg-secondary text-white border-secondary"
                  : "bg-white text-slate-700 border-border hover:border-secondary/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : error ? null : items.length === 0 ? (
          <EmptyState
            title={
              filter === "todos"
                ? "Você ainda não possui documentos cadastrados."
                : "Nenhum documento neste filtro"
            }
            description="Anexe PDFs no detalhe do caminhão e informe a data de validade."
            dashed
            action={
              <Link
                to="/"
                className="inline-flex px-4 py-2 rounded-lg bg-secondary text-white text-sm font-semibold"
              >
                Ir para a frota
              </Link>
            }
          />
        ) : (
          <Card noPadding>
            <div className="divide-y divide-border sm:hidden">
              {items.map((doc) => (
                <div key={doc.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-text-primary">{doc.nome_original}</p>
                      <p className="mt-1 text-sm text-text-light">{doc.tipo_documento || "—"}</p>
                    </div>
                    <StatusBadge status={STATUS_LABEL[doc.status] || doc.status} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    {doc.placa ? (
                      <Link to={`/caminhao/${doc.placa}`} className="font-mono font-semibold tracking-wide text-secondary">
                        {doc.placa}
                      </Link>
                    ) : <span>—</span>}
                    <span className="whitespace-nowrap text-text-light">Validade: {formatDate(doc.validade_em) || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden sm:block">
            <DataTable fixed={false}>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableTh>Placa</DataTableTh>
                    <DataTableTh>Documento</DataTableTh>
                    <DataTableTh>Tipo</DataTableTh>
                    <DataTableTh>Validade</DataTableTh>
                    <DataTableTh>Status</DataTableTh>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {items.map((doc) => (
                    <DataTableRow key={doc.id}>
                      <DataTableTd>
                        {doc.placa ? (
                          <Link
                            to={`/caminhao/${doc.placa}`}
                            className="font-mono font-semibold tracking-wide text-secondary hover:underline"
                          >
                            {doc.placa}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </DataTableTd>
                      <DataTableTd className="font-medium">{doc.nome_original}</DataTableTd>
                      <DataTableTd>{doc.tipo_documento || "—"}</DataTableTd>
                      <DataTableTd className="whitespace-nowrap">{formatDate(doc.validade_em) || "—"}</DataTableTd>
                      <DataTableTd><StatusBadge status={STATUS_LABEL[doc.status] || doc.status} /></DataTableTd>
                    </DataTableRow>
                  ))}
                </DataTableBody>
            </DataTable>
            </div>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}
