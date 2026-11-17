import React from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  TableRowActions,
} from "../ui";
import Icon from "../ui/Icon.jsx";
import { carretasVinculadas, tipoVeiculoLabel } from "../../utils/vehicleDisplay.js";
import { formatNumber } from "../../utils/formatters.js";

const TIPO_TONE = {
  truck: "bg-sky-50 text-sky-700 border-sky-200",
  cavalo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  carreta: "bg-amber-50 text-amber-800 border-amber-200",
};

function TipoBadge({ tipo }) {
  const key = String(tipo || "truck").toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-px text-[11px] font-semibold ${TIPO_TONE[key] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {tipoVeiculoLabel(tipo)}
    </span>
  );
}

TipoBadge.propTypes = { tipo: PropTypes.string };

function Composicao({ caminhao }) {
  const carretas = carretasVinculadas(caminhao);
  if (!carretas.length) return <span className="text-text-light">—</span>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Icon name="link" className="h-3.5 w-3.5 text-text-light" />
      {carretas.map((c) => (
        <span key={`${c.ordem}-${c.placa}`} className="plate !text-[11px]" title={c.modelo ? `${c.ordem}ª carreta — ${c.modelo}` : `${c.ordem}ª carreta`}>
          {c.placa}
        </span>
      ))}
    </div>
  );
}

Composicao.propTypes = { caminhao: PropTypes.object.isRequired };

/**
 * Lista da frota em tabela (desktop) e cartões compactos (celular).
 * Ações: abrir detalhe, editar e excluir — exibidas conforme permissão.
 */
export default function FleetTable({ caminhoes, canWrite, onDelete }) {
  const navigate = useNavigate();
  const open = (placa) => navigate(`/caminhao/${encodeURIComponent(placa)}`);

  return (
    <>
      <ul className="divide-y divide-border md:hidden">
        {caminhoes.map((c) => (
          <li key={c.id} className="flex items-start gap-3 px-4 py-3.5">
            <Link to={`/caminhao/${encodeURIComponent(c.placa)}`} className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="plate">{c.placa}</span>
                <TipoBadge tipo={c.tipo_veiculo} />
              </div>
              <p className="truncate text-sm text-text-primary">
                {[c.marca, c.modelo].filter(Boolean).join(" ") || "Modelo não informado"}
                {c.ano ? <span className="text-text-secondary"> · {c.ano}</span> : null}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-1">
                  <Icon name="user" className="h-3.5 w-3.5" />
                  {c.motorista || "Sem motorista"}
                </span>
                {c.km_atual ? (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Icon name="gauge" className="h-3.5 w-3.5" />
                    {formatNumber(c.km_atual)} km
                  </span>
                ) : null}
              </div>
              {carretasVinculadas(c).length ? <Composicao caminhao={c} /> : null}
            </Link>
            {canWrite ? (
              <TableRowActions
                onEdit={() => navigate(`/caminhao/editar/${encodeURIComponent(c.placa)}`)}
                onDelete={() => onDelete(c)}
                editTitle={`Editar caminhão ${c.placa}`}
                deleteTitle={`Excluir caminhão ${c.placa}`}
              />
            ) : null}
          </li>
        ))}
      </ul>

      <DataTable className="hidden md:block" fixed={false}>
        <DataTableHead>
          <tr>
            <DataTableTh>Veículo</DataTableTh>
            <DataTableTh>Modelo</DataTableTh>
            <DataTableTh>Motorista</DataTableTh>
            <DataTableTh>Composição</DataTableTh>
            <DataTableTh align="right">KM atual</DataTableTh>
            <DataTableTh align="right">
              <span className="sr-only">Ações</span>
            </DataTableTh>
          </tr>
        </DataTableHead>
        <DataTableBody>
          {caminhoes.map((c) => (
            <DataTableRow key={c.id} onClick={() => open(c.placa)}>
              <DataTableTd className="whitespace-nowrap">
                <div className="flex items-center gap-2.5">
                  <Link
                    to={`/caminhao/${encodeURIComponent(c.placa)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="plate hover:border-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                  >
                    {c.placa}
                  </Link>
                  <TipoBadge tipo={c.tipo_veiculo} />
                </div>
              </DataTableTd>
              <DataTableTd>
                <p className="font-medium text-text-primary">
                  {[c.marca, c.modelo].filter(Boolean).join(" ") || <span className="text-text-light">Não informado</span>}
                </p>
                {c.ano ? <p className="text-xs text-text-secondary">{c.ano}</p> : null}
              </DataTableTd>
              <DataTableTd>
                {c.motorista ? (
                  <span className="text-text-primary">{c.motorista}</span>
                ) : (
                  <span className="text-text-light">Sem motorista</span>
                )}
              </DataTableTd>
              <DataTableTd>
                <Composicao caminhao={c} />
              </DataTableTd>
              <DataTableTd align="right" className="whitespace-nowrap tabular-nums">
                {c.km_atual ? `${formatNumber(c.km_atual)} km` : <span className="text-text-light">—</span>}
              </DataTableTd>
              <DataTableTd align="right">
                <div onClick={(e) => e.stopPropagation()} role="presentation">
                  <TableRowActions
                    onView={() => open(c.placa)}
                    onEdit={canWrite ? () => navigate(`/caminhao/editar/${encodeURIComponent(c.placa)}`) : undefined}
                    onDelete={canWrite ? () => onDelete(c) : undefined}
                    viewTitle={`Abrir ${c.placa}`}
                    editTitle={`Editar caminhão ${c.placa}`}
                    deleteTitle={`Excluir caminhão ${c.placa}`}
                  />
                </div>
              </DataTableTd>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </>
  );
}

FleetTable.propTypes = {
  caminhoes: PropTypes.array.isRequired,
  canWrite: PropTypes.bool,
  onDelete: PropTypes.func,
};
