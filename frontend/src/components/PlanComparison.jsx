import React, { useState } from "react";
import {
  COMPARE_PLAN_HEADERS,
  COMPARE_PLAN_IDS,
  PLAN_COMPARE_SECTIONS,
} from "../utils/planComparison.js";

function CellValue({ value }) {
  if (value === true) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary/10 text-secondary">
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="text-text-light" aria-label="Não incluído">
        —
      </span>
    );
  }
  return <span className="text-sm font-medium text-text-primary">{String(value)}</span>;
}

function CompareSection({ section, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-background sm:px-5"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-text-primary sm:text-base">
          {section.title}
        </span>
        <svg
          className={`h-5 w-5 shrink-0 text-secondary transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border px-2 pb-3 pt-1 sm:px-4 sm:pb-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-light">
                  <th className="px-3 py-2 font-semibold">Recurso</th>
                  {COMPARE_PLAN_IDS.map((id) => (
                    <th
                      key={id}
                      className="px-3 py-2 text-center font-semibold text-text-secondary"
                    >
                      {COMPARE_PLAN_HEADERS[id]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => (
                  <tr
                    key={row.label}
                    className="border-t border-border/80 text-text-secondary"
                  >
                    <td className="px-3 py-2.5 pr-4 text-text-primary">
                      {row.label}
                    </td>
                    {COMPARE_PLAN_IDS.map((id) => (
                      <td key={id} className="px-3 py-2.5 text-center align-middle">
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
    <section className="rounded-2xl border border-border bg-background px-4 py-8 sm:px-6 sm:py-10">
      <div className="text-center">
        <h2 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
          Compare os planos
        </h2>
        <p className="mt-1.5 text-sm text-text-secondary">
          Detalhes do que cada plano inclui na ATrack.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
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
