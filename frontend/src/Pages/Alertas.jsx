import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../components/layout/PageLayout.jsx";
import { Alert, Button, Card, PageHeader, StatCard, StatusBadge } from "../components/ui";
import EmptyState from "../components/EmptyState.jsx";
import { CardSkeleton } from "../components/Skeleton.jsx";
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

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch({ url: "/ops/alerts" });
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

  return (
    <PageLayout>
      <div className="space-y-6">
        <PageHeader
          title="Alertas"
          subtitle="Documentos, CNH, pneus, manutenções e gastos a vencer."
        />
        {error && (
          <Alert type="error" title="Não foi possível carregar os alertas">
            {error}
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={load}>
                Tentar novamente
              </Button>
            </div>
          </Alert>
        )}

        {data?.counts && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total" value={data.counts.total} />
            <StatCard title="Críticos" value={data.counts.critical} color="orange" />
            <StatCard title="Altos" value={data.counts.high} color="orange" />
            <StatCard title="Médios" value={data.counts.medium} color="amber" />
          </div>
        )}

        {loading ? (
          <CardSkeleton />
        ) : error ? null : !data?.alerts?.length ? (
          <EmptyState
            title="Nenhum alerta no momento"
            description="Quando documentos, CNHs, pneus ou manutenções entrarem em risco, eles aparecem aqui."
            dashed
          />
        ) : (
          <section className="space-y-3" aria-labelledby="alertas-operacionais">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-label">Fila operacional</p>
                <h2 id="alertas-operacionais" className="text-lg font-semibold text-text-primary">
                  Itens que exigem atenção
                </h2>
              </div>
              <span className="text-sm tabular-nums text-text-secondary">
                {data.alerts.length} {data.alerts.length === 1 ? "alerta" : "alertas"}
              </span>
            </div>
            {data.alerts.map((a) => (
              <Card
                key={a.id}
                className={a.severity === "critical" ? "border-l-4 border-l-red-500" : a.severity === "high" ? "border-l-4 border-l-orange-500" : "border-l-4 border-l-amber-400"}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <StatusBadge status={SEVERITY_LABEL[a.severity] || a.severity} />
                    <h3 className="mt-2 font-semibold text-text-primary">{a.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">{a.message}</p>
                  </div>
                  {a.href && (
                    <Link
                      to={a.href}
                      className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-secondary transition-colors hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                    >
                      Abrir →
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </section>
        )}
      </div>
    </PageLayout>
  );
}
