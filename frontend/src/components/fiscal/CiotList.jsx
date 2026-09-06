import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Button, LoadingSpinner, StatusBadge } from "../ui";
import EmptyState from "../EmptyState.jsx";
import { CATEGORIA_CIOT } from "../../utils/ciotForms.js";
import {
  ciotRegistradoNoContrato,
  labelStatusCiot,
  labelStatusContrato,
  numeroCiotDoContrato,
} from "../../utils/contratoFrete.js";

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
  onRegistrarCiot,
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
        description="Crie o contrato da operação. O CIOT é registrado depois, quando for necessário."
        dashed
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-text-secondary">
            <th className="px-3 py-2.5 font-medium">Contrato</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">CIOT</th>
            <th className="px-3 py-2.5 font-medium">Categoria</th>
            <th className="px-3 py-2.5 font-medium">Veículo</th>
            <th className="px-3 py-2.5 font-medium">Frete</th>
            <th className="px-3 py-2.5 font-medium">Viagem</th>
            <th className="px-3 py-2.5 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const ciotOk = ciotRegistradoNoContrato(row);
            const ciotStatus = row.ciot?.status || row.ciot_status || "nao_registrado";
            const categoria =
              row.categoria_operacao ||
              CATEGORIA_CIOT[row.tipo_operacao] ||
              "—";
            return (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2.5 font-medium">
                  #{String(row.id).padStart(6, "0")}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={labelStatusContrato(row.status)} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <StatusBadge status={labelStatusCiot(ciotStatus)} />
                    <span className="text-xs text-text-secondary">
                      {numeroCiotDoContrato(row) || "—"}
                    </span>
                  </div>
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
                    {!ciotOk &&
                      row.status !== "cancelado" &&
                      typeof onRegistrarCiot === "function" && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => onRegistrarCiot?.(row)}
                        >
                          Registrar CIOT
                        </Button>
                      )}
                    {ciotOk && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onEncerrar?.(row)}
                      >
                        Encerrar CIOT
                      </Button>
                    )}
                    {ciotOk && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => onCancel?.(row)}
                      >
                        Cancelar CIOT
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
  onRegistrarCiot: PropTypes.func,
};
