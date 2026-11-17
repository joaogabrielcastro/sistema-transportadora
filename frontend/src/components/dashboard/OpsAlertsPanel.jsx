import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Button, Card } from "../ui";
import Icon from "../ui/Icon.jsx";

/** Categorias derivadas do campo `entity` retornado por GET /ops/alerts. */
const CATEGORIES = [
  { id: "all", label: "Todas" },
  { id: "documento", label: "Documentos", icon: "document" },
  { id: "motorista", label: "CNH", icon: "user" },
  { id: "checklist", label: "Manutenção", icon: "wrench" },
  { id: "pneu", label: "Pneus", icon: "tire" },
  { id: "gasto", label: "Pagamentos", icon: "receipt" },
];

const ICON_BY_ENTITY = Object.fromEntries(
  CATEGORIES.filter((c) => c.icon).map((c) => [c.id, c.icon]),
);

const SEVERITY = {
  critical: { label: "Crítico", dot: "bg-red-500", text: "text-red-700", ring: "bg-red-50 text-red-600 ring-red-100" },
  high: { label: "Alto", dot: "bg-orange-500", text: "text-orange-700", ring: "bg-orange-50 text-orange-600 ring-orange-100" },
  medium: { label: "Atenção", dot: "bg-amber-400", text: "text-amber-700", ring: "bg-amber-50 text-amber-600 ring-amber-100" },
  low: { label: "Baixo", dot: "bg-slate-400", text: "text-slate-600", ring: "bg-slate-50 text-slate-500 ring-slate-200" },
};

const INITIAL_VISIBLE = 6;

/**
 * Fila de pendências operacionais: o que precisa de ação hoje, ordenado por
 * severidade (ordem já vem do backend). Cada item leva direto à tela de solução.
 */
export default function OpsAlertsPanel({ data, isLoading, error, onRetry }) {
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const alerts = useMemo(() => data?.alerts ?? [], [data]);
  const counts = data?.counts ?? { total: 0, critical: 0, high: 0, medium: 0 };

  const byCategory = useMemo(() => {
    const map = {};
    for (const a of alerts) map[a.entity] = (map[a.entity] || 0) + 1;
    return map;
  }, [alerts]);

  const filtered = category === "all" ? alerts : alerts.filter((a) => a.entity === category);
  const visible = expanded ? filtered : filtered.slice(0, INITIAL_VISIBLE);

  return (
    <Card
      noPadding
      className="overflow-hidden"
      title={
        <span className="flex items-center gap-2">
          Pendências da operação
          {!isLoading && counts.total > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-text-secondary">
              {counts.total}
            </span>
          ) : null}
        </span>
      }
      subtitle="Documentos, CNHs, pneus, manutenções e pagamentos que vencem em até 30 dias."
      action={
        !isLoading && counts.total > 0 ? (
          <div className="flex items-center gap-3 text-xs font-medium">
            {counts.critical > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-red-700">
                <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                {counts.critical} crítico{counts.critical === 1 ? "" : "s"}
              </span>
            ) : null}
            {counts.high > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-orange-700">
                <span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden />
                {counts.high} alto{counts.high === 1 ? "" : "s"}
              </span>
            ) : null}
            {counts.medium > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
                {counts.medium} atenção
              </span>
            ) : null}
          </div>
        ) : null
      }
    >
      {error ? (
        <div className="flex flex-col items-start gap-3 p-5 text-sm text-text-secondary">
          <p>Não foi possível carregar as pendências. {error.message}</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : isLoading ? (
        <ul className="divide-y divide-border" aria-label="Carregando pendências">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-5 py-3.5">
              <span className="h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
              <span className="flex-1 space-y-2">
                <span className="block h-3.5 w-1/2 animate-pulse rounded bg-slate-100" />
                <span className="block h-3 w-1/3 animate-pulse rounded bg-slate-100" />
              </span>
            </li>
          ))}
        </ul>
      ) : alerts.length === 0 ? (
        <div className="flex items-center gap-4 px-5 py-8">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
            <Icon name="checkCircle" className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-text-primary">Tudo em dia</p>
            <p className="text-sm text-text-secondary">
              Nenhum documento, CNH, pneu, manutenção ou pagamento exige atenção nos próximos 30 dias.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="scrollbar-thin flex gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5 sm:px-5" role="group" aria-label="Filtrar pendências por categoria">
            {CATEGORIES.filter((c) => c.id === "all" || byCategory[c.id]).map((c) => {
              const n = c.id === "all" ? alerts.length : byCategory[c.id];
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setCategory(c.id);
                    setExpanded(false);
                  }}
                  className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-primary text-white"
                      : "bg-slate-100 text-text-secondary hover:bg-slate-200 hover:text-text-primary"
                  }`}
                >
                  {c.label}
                  <span className={`tabular-nums ${active ? "text-white/70" : "text-text-light"}`}>{n}</span>
                </button>
              );
            })}
          </div>
          <ul className="divide-y divide-border">
            {visible.map((a) => {
              const sev = SEVERITY[a.severity] || SEVERITY.low;
              return (
                <li key={a.id}>
                  <Link
                    to={a.href || "/"}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none sm:px-5"
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${sev.ring}`}>
                      <Icon name={ICON_BY_ENTITY[a.entity] || "alert"} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sev.dot}`} aria-hidden />
                        <span className="truncate text-sm font-medium text-text-primary">{a.title}</span>
                      </span>
                      <span className="mt-0.5 block truncate pl-3.5 text-xs text-text-secondary">{a.message}</span>
                    </span>
                    <span className={`hidden shrink-0 text-xs font-semibold sm:inline ${sev.text}`}>{sev.label}</span>
                    <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-text-light transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
          {filtered.length > INITIAL_VISIBLE ? (
            <div className="border-t border-border px-4 py-2.5 sm:px-5">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-[13px] font-semibold text-secondary-dark hover:text-secondary"
              >
                {expanded ? "Mostrar menos" : `Ver todas as ${filtered.length} pendências`}
              </button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

OpsAlertsPanel.propTypes = {
  data: PropTypes.shape({ alerts: PropTypes.array, counts: PropTypes.object }),
  isLoading: PropTypes.bool,
  error: PropTypes.object,
  onRetry: PropTypes.func,
};
