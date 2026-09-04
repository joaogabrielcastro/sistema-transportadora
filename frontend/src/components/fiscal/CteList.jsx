import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Button, LoadingSpinner, StatusBadge } from "../ui";
import EmptyState from "../EmptyState.jsx";
import {
  arquivoDisponivel,
  estadoSelecaoTotal,
  idsDe,
} from "../../utils/fiscalDownload.js";

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

/** Botão de download individual (PDF/XML); desabilitado quando o path é null. */
function DownloadCell({ row, formato, onDownload }) {
  const disponivel = arquivoDisponivel(row, formato);
  const rotulo = formato.toUpperCase();
  const btn = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!disponivel}
      onClick={() => onDownload?.(row, formato)}
      title={
        disponivel
          ? `Baixar ${rotulo}`
          : `${rotulo} ainda não disponível`
      }
    >
      {rotulo}
    </Button>
  );
  // <span> title garante o tooltip mesmo com o botão desabilitado.
  return disponivel ? (
    btn
  ) : (
    <span title={`${rotulo} ainda não disponível`}>{btn}</span>
  );
}

DownloadCell.propTypes = {
  row: PropTypes.object.isRequired,
  formato: PropTypes.oneOf(["pdf", "xml"]).isRequired,
  onDownload: PropTypes.func,
};

/** Tabela dos CT-e (rascunho, emitidos, rejeitados). */
export default function CteList({
  items = [],
  clientes = [],
  loading = false,
  onView,
  onCancel,
  onComplemento,
  onSubstituir,
  onEmit,
  onConsult,
  onEditDraft,
  onDeleteDraft,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onDownload,
}) {
  const clienteById = useMemo(() => {
    const map = new Map();
    for (const c of clientes) map.set(String(c.id), c);
    return map;
  }, [clientes]);

  const selecionaveis = useMemo(() => idsDe(items), [items]);
  const selecionados = useMemo(
    () => (selectedIds instanceof Set ? selectedIds : new Set()),
    [selectedIds],
  );
  const selecionavel = typeof onToggleRow === "function";
  const qtdSelecionada = useMemo(
    () => selecionaveis.filter((id) => selecionados.has(id)).length,
    [selecionaveis, selecionados],
  );
  const estado = estadoSelecaoTotal(selecionaveis.length, qtdSelecionada);

  if (loading) return <LoadingSpinner />;

  if (!items.length) {
    return (
      <EmptyState
        title="Nenhum CT-e encontrado"
        description="Salve um rascunho ou emita o primeiro CT-e na aba Emitir."
        dashed
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-text-secondary">
            {selecionavel && (
              <th className="px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os CT-e do filtro atual"
                  className="h-4 w-4 rounded border-border"
                  checked={estado === "all"}
                  ref={(el) => {
                    if (el) el.indeterminate = estado === "some";
                  }}
                  onChange={() => onToggleAll?.()}
                />
              </th>
            )}
            <th className="px-3 py-2.5 font-medium">Número</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Cliente / tomador</th>
            <th className="px-3 py-2.5 font-medium">Valor</th>
            <th className="px-3 py-2.5 font-medium">Emissão</th>
            <th className="px-3 py-2.5 font-medium">Arquivos</th>
            <th className="px-3 py-2.5 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const cliente = clienteById.get(String(row.cliente_id));
            const podeCancelar = row.status === "processado";
            const podeEmitir = [
              "rascunho",
              "rejeitado",
              "erro",
              "pendente",
            ].includes(row.status);
            const podeConsultar =
              Boolean(row.chave_acesso) ||
              Boolean(row.brasil_nfe_id) ||
              row.status === "processando";
            const podeEditar = podeEmitir;
            const podeExcluir = row.status === "rascunho";
            const marcado = selecionados.has(Number(row.id));
            return (
              <tr key={row.id} className="border-t border-border">
                {selecionavel && (
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar CT-e ${row.numero || row.id}`}
                      className="h-4 w-4 rounded border-border"
                      checked={marcado}
                      onChange={() => onToggleRow?.(Number(row.id))}
                    />
                  </td>
                )}
                <td className="px-3 py-2.5 font-medium">
                  {[row.numero, row.serie].filter(Boolean).join("/") || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={row.status || "pendente"} />
                    {row.status === "processando" && (
                      <span className="text-xs text-text-secondary">
                        Aguardando SEFAZ — consulte
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {cliente?.razao_social || `#${row.cliente_id}`}
                </td>
                <td className="px-3 py-2.5">{fmtMoney(row.valor_frete)}</td>
                <td className="px-3 py-2.5">
                  {fmtDate(row.data_emissao || row.criado_em)}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-2">
                    <DownloadCell
                      row={row}
                      formato="pdf"
                      onDownload={onDownload}
                    />
                    <DownloadCell
                      row={row}
                      formato="xml"
                      onDownload={onDownload}
                    />
                  </div>
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
                    {podeEditar && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onEditDraft?.(row)}
                      >
                        Continuar rascunho
                      </Button>
                    )}
                    {podeEmitir && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onEmit?.(row)}
                      >
                        Emitir
                      </Button>
                    )}
                    {podeConsultar && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onConsult?.(row)}
                      >
                        Consultar
                      </Button>
                    )}
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
                    {podeExcluir && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteDraft?.(row)}
                      >
                        Excluir
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
  onEmit: PropTypes.func,
  onConsult: PropTypes.func,
  onEditDraft: PropTypes.func,
  onDeleteDraft: PropTypes.func,
  selectedIds: PropTypes.instanceOf(Set),
  onToggleRow: PropTypes.func,
  onToggleAll: PropTypes.func,
  onDownload: PropTypes.func,
};
