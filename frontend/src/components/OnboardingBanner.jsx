import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/apiClient.js";
import { Button } from "./ui";

/**
 * Checklist de primeiros passos — some após concluir ou dispensar.
 */
export default function OnboardingBanner({ onDismissed }) {
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch({ url: "/ops/onboarding" });
        if (!cancelled) {
          setStatus(res.data);
          setLoadError(false);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError && !status) {
    return (
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Não foi possível carregar os primeiros passos. Recarregue a página ou
        continue pelo menu: cadastre um veículo, um motorista e um gasto para
        começar.
      </div>
    );
  }

  if (!status || status.dismissed) return null;
  if (status.progress?.completed === status.progress?.total) {
    return null;
  }

  const complete = async () => {
    setBusy(true);
    try {
      await apiFetch({ method: "POST", url: "/ops/onboarding/complete" });
      setStatus((s) => ({ ...s, dismissed: true }));
      onDismissed?.();
    } finally {
      setBusy(false);
    }
  };

  const done = status.progress?.completed ?? 0;
  const total = status.progress?.total ?? status.steps?.length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const pending = (status.steps || []).filter((step) => !step.done);
  const finished = (status.steps || []).filter((step) => step.done);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(#0891B2 ${pct * 3.6}deg, #E3E8EF 0deg)` }}
            aria-hidden
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-bold tabular-nums text-text-primary">
              {done}/{total}
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-text-primary">Primeiros passos</h2>
            <p className="text-sm text-text-secondary">
              {done} de {total} concluídos — configure a operação em minutos.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pending.map((step) => (
            <Link
              key={step.id}
              to={step.href}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-light"
            >
              {step.title} <span aria-hidden>→</span>
            </Link>
          ))}
          <Button variant="ghost" size="sm" loading={busy} onClick={complete}>
            Dispensar
          </Button>
        </div>
      </div>
      {finished.length ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border bg-slate-50/60 px-4 py-2.5 text-xs text-text-secondary sm:px-5">
          {finished.map((step) => (
            <li key={step.id} className="inline-flex items-center gap-1.5">
              <span className="text-emerald-600" aria-hidden>✓</span>
              <Link to={step.href} className="hover:text-text-primary">{step.title}</Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
