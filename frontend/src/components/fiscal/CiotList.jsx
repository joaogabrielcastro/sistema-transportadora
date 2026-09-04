import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Button, LoadingSpinner, StatusBadge } from "../ui";
import EmptyState from "../EmptyState.jsx";
import { CATEGORIA_CIOT } from "../../utils/ciotForms.js";

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function fmtMoney(value) {
  if (value == null || value === "") return "—";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const CATEGORIA_LABEL = {
  lotacao: "Lotação",
  fracionada: "Fracionada",
  tac_agregado: "TAC-Agregado",
};

export default function CiotList({
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
        title="Nenhum contrato de frete"
        description="Declare o primeiro CIOT na aba Contrato de frete."
        dashed
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-text-secondary">
            <th className="px-3 py-2.5 font-medium">CIOT</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Categoria</th>
            <th className="px-3 py-2.5 font-medium">Veículo</th>
            <th className="px-3 py-2.5 font-medium">Frete</th>
            <th className="px-3 py-2.5 font-medium">Viagem</th>
            <th className="px-3 py-2.5 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const podeAcao = row.status === "declarado";
            const categoria =
              row.categoria_operacao ||
              CATEGORIA_CIOT[row.tipo_operacao] ||
              "—";
            return (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2.5 font-medium">
                  {row.codigo_identificacao_operacao ||
                    row.id_operacao_transporte ||
                    `#${row.id}`}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={row.status || "pendente"} />
                </td>
                <td className="px-3 py-2.5">
                  {CATEGORIA_LABEL[categoria] || categoria}
                </td>
                <td className="px-3 py-2.5">
                  {placaById.get(String(row.caminhao_id)) ||
                    (row.caminhao_id ? `#${row.caminhao_id}` : "—")}
                </td>
                <td className="px-3 py-2.5">{fmtMoney(row.valor_frete)}</td>
                <td className="px-3 py-2.5">
                  {fmtDate(row.data_inicio_viagem)}
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
                    {podeAcao && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onEncerrar?.(row)}
                      >
                        Encerrar
                      </Button>
                    )}
                    {podeAcao && (
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

CiotList.propTypes = {
  items: PropTypes.array,
  caminhoes: PropTypes.array,
  loading: PropTypes.bool,
  onView: PropTypes.func,
  onCancel: PropTypes.func,
  onEncerrar: PropTypes.func,
};
