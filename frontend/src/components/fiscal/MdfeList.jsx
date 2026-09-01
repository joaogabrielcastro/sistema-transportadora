import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Button, LoadingSpinner, StatusBadge } from "../ui";
import EmptyState from "../EmptyState.jsx";

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

/** Tabela dos MDF-e emitidos. */
export default function MdfeList({
  items = [],
  caminhoes = [],
  loading = false,
  onView,
  onCancel,
  onEncerrar,
}) {
  const placaById = useMemo(() => {
    const map = new Map();
    for (const c of caminhoes) map.set(String(c.id), c.placa);
    return map;
  }, [caminhoes]);

  if (loading) return <LoadingSpinner />;

  if (!items.length) {
    return (
      <EmptyState
        title="Nenhum MDF-e emitido"
        description="Emita o primeiro MDF-e na aba Emitir."
        dashed
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-text-secondary">
            <th className="px-3 py-2.5 font-medium">Número</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Veículo</th>
            <th className="px-3 py-2.5 font-medium">Emissão</th>
            <th className="px-3 py-2.5 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const podeCancelar = row.status === "processado";
            const podeEncerrar = row.status === "processado";
            return (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2.5 font-medium">
                  {[row.numero, row.serie].filter(Boolean).join("/") || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={row.status || "pendente"} />
                </td>
                <td className="px-3 py-2.5">
                  {placaById.get(String(row.caminhao_id)) ||
                    (row.caminhao_id ? `#${row.caminhao_id}` : "—")}
                </td>
                <td className="px-3 py-2.5">
                  {fmtDate(row.data_emissao || row.criado_em)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onView?.(row)}
                    >
                      Ver detalhe
                    </Button>
                    {podeEncerrar && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onEncerrar?.(row)}
                      >
                        Encerrar
                      </Button>
                    )}
                    {podeCancelar && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => onCancel?.(row)}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

MdfeList.propTypes = {
  items: PropTypes.array,
  caminhoes: PropTypes.array,
  loading: PropTypes.bool,
  onView: PropTypes.func,
  onCancel: PropTypes.func,
  onEncerrar: PropTypes.func,
};
