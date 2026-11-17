import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Icon from "../ui/Icon.jsx";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";
import { apiFetch, parseApiError } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray } from "../../utils/extractApiArray.js";

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const TIPO_LABEL = { truck: "Truck", cavalo: "Cavalo", carreta: "Carreta" };

/**
 * Busca rápida (Ctrl/⌘ + K): navega para qualquer módulo, dispara ações de
 * cadastro e encontra veículos por placa, motorista ou modelo
 * (GET /caminhoes/search — mesmo endpoint da busca da frota).
 */
export default function CommandPalette({ open, onClose, destinations, actions }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounced = useDebouncedValue(query, 250);
  const term = debounced.trim();

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    setHighlight(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const vehiclesQuery = useQuery({
    queryKey: queryKeys.caminhoes.search(term, ""),
    queryFn: async () => {
      try {
        const res = await apiFetch({
          method: "GET",
          url: `/caminhoes/search?${new URLSearchParams({ term })}`,
        });
        return extractApiArray(res);
      } catch (err) {
        throw await parseApiError(err);
      }
    },
    enabled: open && term.length >= 2,
    staleTime: 30_000,
  });

  const results = useMemo(() => {
    const q = normalize(query.trim());
    const match = (item) =>
      !q ||
      normalize(`${item.label} ${item.description || ""} ${item.section || ""} ${item.keywords || ""}`).includes(q);

    const vehicles = (term.length >= 2 ? vehiclesQuery.data || [] : [])
      .slice(0, 6)
      .map((v) => ({
        key: `veh-${v.id}`,
        group: "Veículos",
        label: v.placa,
        plate: true,
        description: [TIPO_LABEL[v.tipo_veiculo] || v.tipo_veiculo, [v.marca, v.modelo].filter(Boolean).join(" "), v.motorista]
          .filter(Boolean)
          .join(" · "),
        icon: "truck",
        to: `/caminhao/${encodeURIComponent(v.placa)}`,
      }));

    const acts = actions.filter(match).map((a) => ({
      key: `act-${a.id}`,
      group: "Ações",
      label: a.label,
      description: a.description,
      icon: a.icon,
      to: a.to,
    }));

    const dests = destinations.filter(match).map((d) => ({
      key: `nav-${d.path}`,
      group: "Ir para",
      label: d.label,
      description: d.section,
      icon: d.icon,
      to: d.path,
    }));

    // Termo com dígitos parece placa: veículos primeiro. Caso contrário,
    // ações e módulos vêm antes (ex.: "relat" não deve abrir a carreta "Librelato").
    const navResults = [...acts, ...dests.slice(0, q ? 12 : 8)];
    return /\d/.test(q) || navResults.length === 0
      ? [...vehicles, ...navResults]
      : [...navResults, ...vehicles];
  }, [actions, destinations, query, term, vehiclesQuery.data]);

  useEffect(() => {
    setHighlight(0);
  }, [query, results.length]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  if (!open) return null;

  const go = (item) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[highlight]);
    }
  };

  let lastGroup = null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-3 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Busca rápida">
      <button
        type="button"
        className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]"
        aria-label="Fechar busca"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl animate-pop-in overflow-hidden rounded-2xl border border-border bg-white shadow-pop">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Icon name="search" className="h-5 w-5 text-text-light" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar placa, motorista, módulo ou ação…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-light"
            aria-label="Termo de busca"
            aria-controls="command-results"
            aria-activedescendant={results[highlight] ? `cmd-${results[highlight].key}` : undefined}
          />
          {vehiclesQuery.isFetching ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" aria-hidden />
          ) : (
            <kbd className="kbd">Esc</kbd>
          )}
        </div>
        <ul id="command-results" ref={listRef} role="listbox" className="scrollbar-thin max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-10 text-center text-sm text-text-secondary">
              {term.length >= 2 && vehiclesQuery.isFetching
                ? "Buscando veículos…"
                : "Nada encontrado. Tente a placa completa ou outro termo."}
            </li>
          ) : (
            results.map((item, index) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              const active = index === highlight;
              return (
                <React.Fragment key={item.key}>
                  {header ? (
                    <li className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-light" role="presentation">
                      {header}
                    </li>
                  ) : null}
                  <li
                    id={`cmd-${item.key}`}
                    data-index={index}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setHighlight(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      go(item);
                    }}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${
                      active ? "bg-slate-100" : ""
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${active ? "bg-white text-primary ring-border" : "bg-slate-50 text-text-secondary ring-border"}`}>
                      <Icon name={item.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      {item.plate ? (
                        <span className="plate">{item.label}</span>
                      ) : (
                        <span className="block truncate text-sm font-medium text-text-primary">{item.label}</span>
                      )}
                      {item.description ? (
                        <span className="mt-0.5 block truncate text-xs text-text-secondary">{item.description}</span>
                      ) : null}
                    </span>
                    {active ? <Icon name="arrowRight" className="h-4 w-4 text-text-light" /> : null}
                  </li>
                </React.Fragment>
              );
            })
          )}
        </ul>
        <div className="hidden items-center gap-4 border-t border-border bg-slate-50/70 px-4 py-2 text-[11px] text-text-secondary sm:flex">
          <span className="flex items-center gap-1"><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="kbd">Enter</kbd> abrir</span>
          <span className="ml-auto">Digite 2+ caracteres para buscar veículos</span>
        </div>
      </div>
    </div>
  );
}

CommandPalette.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  destinations: PropTypes.array.isRequired,
  actions: PropTypes.array.isRequired,
};
