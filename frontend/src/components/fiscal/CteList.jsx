import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Button, LoadingSpinner, StatusBadge } from "../ui";
import EmptyState from "../EmptyState.jsx";

function fmtMoney(value) {
  if (value == null || value === "") return "—";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR");
}

/** Tabela dos CT-e emitidos. */
export default function CteList({
  items = [],
  clientes = [],
  loading = false,
  onView,
  onCancel,
  onComplemento,
  onSubstituir,
}) {
  const clienteById = useMemo(() => {
    const map = new Map();
    for (const c of clientes) map.set(String(c.id), c);
    return map;
  }, [clientes]);

  if (loading) return <LoadingSpinner />;

  if (!items.length) {
    return (
      <EmptyState
        title="Nenhum CT-e emitido"
        description="Emita o primeiro CT-e na aba Emitir."
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
            <th className="px-3 py-2.5 font-medium">Cliente / tomador</th>
            <th className="px-3 py-2.5 font-medium">Valor</th>
            <th className="px-3 py-2.5 font-medium">Emissão</th>
            <th className="px-3 py-2.5 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const cliente = clienteById.get(String(row.cliente_id));
            const podeCancelar = row.status === "processado";
            return (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2.5 font-medium">
                  {[row.numero, row.serie].filter(Boolean).join("/") || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={row.status || "pendente"} />
                </td>
                <td className="px-3 py-2.5">
                  {cliente?.razao_social || `#${row.cliente_id}`}
                </td>
                <td className="px-3 py-2.5">{fmtMoney(row.valor_frete)}</td>
                <td className="px-3 py-2.5">
                  {fmtDate(row.data_emissao || row.criado_em)}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onView?.(row)}
                    >
                      Ver detalhe
                    </Button>
                    {podeCancelar && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onComplemento?.(row)}
                      >
                        Gerar complemento
                      </Button>
                    )}
                    {podeCancelar && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSubstituir?.(row)}
                      >
                        Substituir
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

CteList.propTypes = {
  items: PropTypes.array,
  clientes: PropTypes.array,
  loading: PropTypes.bool,
  onView: PropTypes.func,
  onCancel: PropTypes.func,
  onComplemento: PropTypes.func,
  onSubstituir: PropTypes.func,
};
