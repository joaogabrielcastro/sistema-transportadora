import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/apiClient.js";
import { Button } from "./ui";

/**
 * Checklist de primeiros passos — some após concluir ou dispensar.
 */
export default function OnboardingBanner({ onDismissed }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch({ url: "/ops/onboarding" });
        if (!cancelled) setStatus(res.data);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div className="mb-6 rounded-xl border border-secondary/30 bg-secondary/5 p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Primeiros passos
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {status.progress.completed} de {status.progress.total} concluídos —
            configure a operação em minutos.
          </p>
        </div>
        <Button variant="outline" size="sm" loading={busy} onClick={complete}>
          Dispensar
        </Button>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {status.steps.map((step) => (
          <li key={step.id}>
            <Link
              to={step.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm border ${
                step.done
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-border bg-white text-slate-800 hover:border-secondary/40"
              }`}
            >
              <span aria-hidden>{step.done ? "✓" : "○"}</span>
              <span className={step.done ? "line-through opacity-80" : ""}>
                {step.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
