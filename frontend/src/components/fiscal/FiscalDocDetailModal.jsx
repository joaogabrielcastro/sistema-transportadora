import React from "react";
import PropTypes from "prop-types";
import { Alert, LoadingSpinner, Modal, StatusBadge } from "../ui";

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString("pt-BR");
}

function fmtMoney(value) {
  if (value == null || value === "") return "—";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function Row({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2 last:border-0 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary break-all sm:text-right">
        {value}
      </span>
    </div>
  );
}

Row.propTypes = { label: PropTypes.string, value: PropTypes.node };

/**
 * Detalhe de um CT-e / MDF-e. Quando a emissão foi rejeitada pelo provedor,
 * `erro` traz o texto cru devolvido — ele NÃO é escondido nem resumido, é o
 * que estamos usando para confirmar a integração fiscal.
 */
export default function FiscalDocDetailModal({
  isOpen,
  onClose,
  loading = false,
  doc = null,
  tipo = "cte",
  erro = null,
}) {
  const titulo =
    tipo === "mdfe"
      ? "Detalhe do MDF-e"
      : tipo === "ciot"
        ? "Detalhe do contrato de frete"
        : "Detalhe do CT-e";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titulo} size="lg">
      {loading ? (
        <div className="py-10">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-4">
          {erro && (
            <Alert type="error" title="Retorno do provedor (texto cru)">
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed">
                {typeof erro === "string" ? erro : JSON.stringify(erro, null, 2)}
              </pre>
            </Alert>
          )}

          {doc ? (
            <div className="rounded-lg border border-border px-4 py-2">
              <Row
                label="Status"
                value={
                  doc.status ? <StatusBadge status={doc.status} /> : "—"
                }
              />
              {tipo !== "ciot" && (
                <>
                  <Row
                    label="Número / Série"
                    value={
                      [doc.numero, doc.serie].filter(Boolean).join(" / ") || "—"
                    }
                  />
                  <Row
                    label="Chave de acesso"
                    value={doc.chave_acesso || "— (não gerada)"}
                  />
                  <Row label="Emissão" value={fmtDate(doc.data_emissao)} />
                </>
              )}
              <Row label="Criado em" value={fmtDate(doc.criado_em)} />
              {tipo === "cte" && (
                <Row label="Valor do frete" value={fmtMoney(doc.valor_frete)} />
              )}
              {tipo !== "ciot" && (
                <>
                  <Row
                    label="Ambiente"
                    value={
                      doc.ambiente === 1
                        ? "Produção"
                        : doc.ambiente === 2
                          ? "Homologação"
                          : "—"
                    }
                  />
                  <Row label="Protocolo" value={doc.numero_protocolo || "—"} />
                  {doc.consulta?.mensagem && (
                    <Row
                      label="Consulta"
                      value={
                        `${doc.consulta.origem === "brasil_nfe" ? "Brasil NFe" : "Local"}: ${doc.consulta.mensagem}`
                      }
                    />
                  )}
                  <Row
                    label="Autorizado em"
                    value={fmtDate(doc.autorizado_em)}
                  />
                  <Row
                    label="SEFAZ — código"
                    value={
                      doc.sefaz_codigo != null ? String(doc.sefaz_codigo) : "—"
                    }
                  />
                  <Row
                    label="SEFAZ — mensagem"
                    value={doc.sefaz_mensagem || "—"}
                  />
                  <Row
                    label="SEFAZ — operação"
                    value={doc.sefaz_operacao || "—"}
                  />
                  {doc.sefaz_detalhes != null && (
                    <Row
                      label="SEFAZ — detalhes"
                      value={
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-left text-xs font-normal">
                          {typeof doc.sefaz_detalhes === "string"
                            ? doc.sefaz_detalhes
                            : JSON.stringify(doc.sefaz_detalhes, null, 2)}
                        </pre>
                      }
                    />
                  )}
                </>
              )}
              {tipo === "mdfe" && (
                <>
                  <Row
                    label="Protocolo de encerramento"
                    value={doc.numero_protocolo || "—"}
                  />
                  <Row
                    label="Encerrado em"
                    value={fmtDate(doc.encerrado_em)}
                  />
                </>
              )}
              {tipo === "ciot" && (
                <>
                  <Row
                    label="CIOT"
                    value={doc.codigo_identificacao_operacao || "—"}
                  />
                  <Row
                    label="Id da operação"
                    value={doc.id_operacao_transporte || "—"}
                  />
                  <Row label="Valor do frete" value={fmtMoney(doc.valor_frete)} />
                  <Row
                    label="Início da viagem"
                    value={fmtDate(doc.data_inicio_viagem)}
                  />
                  <Row
                    label="Fim da viagem"
                    value={fmtDate(doc.data_fim_viagem)}
                  />
                </>
              )}
            </div>
          ) : (
            !erro && (
              <p className="text-sm text-text-secondary">
                Nenhum dado para exibir.
              </p>
            )
          )}
        </div>
      )}
    </Modal>
  );
}

FiscalDocDetailModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  doc: PropTypes.object,
  tipo: PropTypes.oneOf(["cte", "mdfe", "ciot"]),
  erro: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
};
