import React, { useEffect, useState } from "react";
import { forceAppReload } from "../versionWatch.js";

/**
 * Faixa fixa quando há deploy novo — o cliente atualiza sem hard refresh manual.
 */
export default function AppUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const onUpdate = () => setVisible(true);
    window.addEventListener("atrack:update-available", onUpdate);
    return () => window.removeEventListener("atrack:update-available", onUpdate);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-950 shadow-sm"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">
          Nova versão do ATrack disponível. Atualize para ver as últimas
          funções (não precisa de hard refresh).
        </p>
        <button
          type="button"
          disabled={updating}
          onClick={async () => {
            setUpdating(true);
            await forceAppReload();
          }}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {updating ? "Atualizando…" : "Atualizar agora"}
        </button>
      </div>
    </div>
  );
}
