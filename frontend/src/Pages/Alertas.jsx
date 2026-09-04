import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout.jsx";
import { Alert, Card, PageHeader, StatCard } from "../components/ui";
import EmptyState from "../components/EmptyState.jsx";
import { apiFetch, parseApiError } from "../lib/apiClient.js";

const SEVERITY_LABEL = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
};

export default function Alertas() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch({ url: "/ops/alerts" });
        setData(res.data);
      } catch (err) {
        const parsed = await parseApiError(err);
        setError(parsed.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PageLayout>
      <div className="space-y-6">
        <PageHeader
          title="Alertas"
          subtitle="Documentos, CNH, pneus e manutenções que precisam de atenção."
        />
        {error && <Alert type="error">{error}</Alert>}

        {data?.counts && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total" value={data.counts.total} />
            <StatCard title="Críticos" value={data.counts.critical} />
            <StatCard title="Altos" value={data.counts.high} />
            <StatCard title="Médios" value={data.counts.medium} />
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : !data?.alerts?.length ? (
          <EmptyState
            title="Nenhum alerta no momento"
            description="Quando documentos, CNHs, pneus ou manutenções entrarem em risco, eles aparecem aqui."
            dashed
          />
        ) : (
          <div className="space-y-3">
            {data.alerts.map((a) => (
              <Card key={a.id}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                      {SEVERITY_LABEL[a.severity] || a.severity}
                    </p>
                    <h3 className="font-semibold text-slate-900">{a.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">{a.message}</p>
                  </div>
                  {a.href && (
                    <Link
                      to={a.href}
                      className="text-sm font-semibold text-secondary whitespace-nowrap"
                    >
                      Abrir →
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
