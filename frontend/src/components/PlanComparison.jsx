import React, { useState } from "react";
import {
  COMPARE_PLAN_HEADERS,
  COMPARE_PLAN_IDS,
  PLAN_COMPARE_SECTIONS,
} from "../utils/planComparison.js";

function CellValue({ value }) {
  if (value === true) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="text-slate-500" aria-label="Não incluído">
        —
      </span>
    );
  }
  return <span className="text-sm text-slate-200">{String(value)}</span>;
}

function CompareSection({ section, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-800/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-800/60"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-white">{section.title}</span>
        <svg
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-700/80 px-2 pb-4 pt-2 sm:px-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-semibold">Recurso</th>
                  {COMPARE_PLAN_IDS.map((id) => (
                    <th key={id} className="px-3 py-2 text-center font-semibold">
                      {COMPARE_PLAN_HEADERS[id]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr
                    key={row.label}
                    className="border-t border-slate-700/50 text-slate-300"
                  >
                    <td className="px-3 py-3 pr-4 text-slate-200">{row.label}</td>
                    {COMPARE_PLAN_IDS.map((id) => (
                      <td key={id} className="px-3 py-3 text-center align-middle">
                        <CellValue value={row[id]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlanComparison() {
  return (
    <section className="rounded-2xl bg-slate-900 px-4 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Compare os planos
        </h2>
        <p className="mt-2 text-sm text-slate-400 sm:text-base">
          Veja o que cada plano inclui para escolher o melhor para sua operação.
        </p>
      </div>

      <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-3">
        {PLAN_COMPARE_SECTIONS.map((section, index) => (
          <CompareSection
            key={section.id}
            section={section}
            defaultOpen={index === 0}
          />
        ))}
      </div>
    </section>
  );
}
