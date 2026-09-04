import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout.jsx";
import { Alert, Card, PageHeader, StatCard } from "../components/ui";
import EmptyState from "../components/EmptyState.jsx";
import { apiFetch, parseApiError } from "../lib/apiClient.js";

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

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch({ url: "/ops/documentos" });
        setData(res.data);
      } catch (err) {
        const parsed = await parseApiError(err);
        setError(parsed.message);
      } finally {
        setLoading(false);
      }
    })();
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
        {error && <Alert type="error">{error}</Alert>}

        {data?.summary && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total" value={data.summary.total} />
            <StatCard title="Vencidos" value={data.summary.vencidos} />
            <StatCard title="Críticos" value={data.summary.criticos} />
            <StatCard title="Atenção" value={data.summary.atencao} />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
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
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum documento neste filtro"
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
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-600 border-b">
                  <tr>
                    <th className="py-2 pr-3">Placa</th>
                    <th className="py-2 pr-3">Documento</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Validade</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((doc) => (
                    <tr key={doc.id} className="border-t border-border">
                      <td className="py-2.5 pr-3">
                        {doc.placa ? (
                          <Link
                            to={`/caminhao/${doc.placa}`}
                            className="text-secondary font-medium"
                          >
                            {doc.placa}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 pr-3">{doc.nome_original}</td>
                      <td className="py-2.5 pr-3">{doc.tipo_documento || "—"}</td>
                      <td className="py-2.5 pr-3">
                        {doc.validade_em
                          ? String(doc.validade_em).slice(0, 10)
                          : "—"}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                            doc.status === "vencido" || doc.status === "critico"
                              ? "bg-red-50 text-red-700"
                              : doc.status === "atencao"
                                ? "bg-amber-50 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {STATUS_LABEL[doc.status] || doc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}
