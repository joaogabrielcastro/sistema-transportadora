import React from "react";

const KPI = [
  { label: "Total de caminhões", hint: "Veículos cadastrados" },
  { label: "Gastos totais", hint: "Gastos + manutenções" },
  { label: "Manutenções", hint: "Registros de checklist" },
  { label: "Alertas", hint: "Pendências da operação" },
];

export default function ProductPreview() {
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        <div className="flex items-center gap-2 border-b border-border bg-primary px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/30" />
          <span className="ml-2 text-xs font-medium text-slate-300">
            ATrack · dashboard da frota
          </span>
        </div>
        <div className="grid gap-0 lg:grid-cols-[11rem_1fr]">
          <aside className="hidden bg-primary-dark p-3 text-slate-300 lg:block">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Visão geral
            </p>
            <div className="rounded-md bg-white/10 px-2 py-1.5 text-xs text-white">
              Início
            </div>
            <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Frota
            </p>
            {["Motoristas", "Documentos", "Pneus"].map((item) => (
              <div key={item} className="rounded-md px-2 py-1.5 text-xs text-slate-400">
                {item}
              </div>
            ))}
            <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Operação
            </p>
            {["Manutenção", "Relatórios", "Alertas"].map((item) => (
              <div key={item} className="rounded-md px-2 py-1.5 text-xs text-slate-400">
                {item}
              </div>
            ))}
          </aside>
          <div className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Visão geral
            </p>
            <p className="mt-1 text-lg font-bold text-text-primary">Dashboard</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {KPI.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border bg-background p-3"
                >
                  <p className="text-[11px] font-medium text-text-secondary">
                    {item.label}
                  </p>
                  <p className="mt-1 text-[11px] text-text-light">{item.hint}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 h-16 overflow-hidden rounded-xl bg-gradient-to-r from-secondary/20 via-secondary/5 to-transparent">
              <svg
                className="h-full w-full text-secondary"
                viewBox="0 0 320 64"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  fill="currentColor"
                  opacity="0.35"
                  d="M0 48 L40 40 L80 44 L120 28 L160 32 L200 18 L240 24 L280 12 L320 20 L320 64 L0 64 Z"
                />
              </svg>
            </div>
            <p className="mt-3 text-[11px] text-text-light">
              Frota recente · busca por placa, motorista ou modelo
            </p>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-text-light">
        Prévia ilustrativa do painel — os números da sua empresa vêm da própria
        conta, depois do cadastro.
      </p>
    </div>
  );
}
