import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Button, LoadingSpinner, Modal, StatusBadge } from "../ui";
import AverbacaoStatusCard from "./AverbacaoStatusCard.jsx";
import {
  ciotRegistradoNoContrato,
  labelStatusCiot,
  labelStatusContrato,
  numeroCiotDoContrato,
} from "../../utils/contratoFrete.js";

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("pt-BR");
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

export default function FiscalDocDetailModal({
  isOpen,
  onClose,
  loading = false,
  doc = null,
  tipo = "cte",
  erro = null,
  onRegistrarCiot,
  registrandoCiot = false,
}) {
  const [averbacao, setAverbacao] = useState(doc?.averbacao ?? null);
  useEffect(() => {
    setAverbacao(doc?.averbacao ?? null);
  }, [doc]);

  const isContrato = tipo === "ciot" || tipo === "contrato";
  const titulo =
    tipo === "mdfe"
      ? "Detalhe do MDF-e"
      : isContrato
        ? "Contrato de Frete"
        : "Detalhe do CT-e";
  const ciotOk = isContrato && ciotRegistradoNoContrato(doc);
  const ciotStatus =
    doc?.ciot?.status || doc?.ciot_status || "nao_registrado";

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
              {isContrato ? (
                <>
                  <Row
                    label="Contrato"
                    value={`#${String(doc.id).padStart(6, "0")}`}
                  />
                  <Row
                    label="Status do contrato"
                    value={
                      doc.status ? (
                        <StatusBadge status={labelStatusContrato(doc.status)} />
                      ) : (
                        "—"
                      )
                    }
                  />
                  <Row
                    label="Contratante"
                    value={doc.cpf_cnpj_contratante || "—"}
                  />
                  <Row
                    label="Transportador"
                    value={doc.cpf_cnpj_contratado || "—"}
                  />
                  <Row label="Valor" value={fmtMoney(doc.valor_frete)} />
                  <Row
                    label="Início da viagem"
                    value={fmtDate(doc.data_inicio_viagem)}
                  />
                  <Row
                    label="Fim da viagem"
                    value={fmtDate(doc.data_fim_viagem)}
                  />
                  <Row label="Criado em" value={fmtDate(doc.criado_em)} />
                </>
              ) : (
                <>
                  <Row
                    label="Status"
                    value={
                      doc.status ? <StatusBadge status={doc.status} /> : "—"
                    }
                  />
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
                  <Row label="Criado em" value={fmtDate(doc.criado_em)} />
                  {tipo === "cte" && (
                    <Row
                      label="Valor do frete"
                      value={fmtMoney(doc.valor_frete)}
                    />
                  )}
                  <Row
                    label="CIOT (ANTT)"
                    value={
                      doc.antt_ciot ||
                      doc.payload_json?.ciot ||
                      doc.payload_json?.inf_antt?.ciot ||
                      "—"
                    }
                  />
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
                      value={`${doc.consulta.origem === "brasil_nfe" ? "Brasil NFe" : "Local"}: ${doc.consulta.mensagem}`}
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

          {doc && isContrato && (
            <div className="rounded-lg border border-border px-4 py-3 space-y-3">
              <p className="text-sm font-semibold text-text-primary">CIOT</p>
              <p className="text-xs text-text-secondary">
                Código da operação na ANTT. Não substitui o contrato de frete.
              </p>
              <div className="rounded-lg border border-border px-4 py-2">
                <Row
                  label="Status"
                  value={<StatusBadge status={labelStatusCiot(ciotStatus)} />}
                />
                <Row
                  label="Número"
                  value={numeroCiotDoContrato(doc) || "Não registrado"}
                />
                <Row
                  label="Provedor"
                  value={doc.ciot?.provider || "—"}
                />
                <Row
                  label="Data de registro"
                  value={fmtDate(doc.ciot?.registered_at)}
                />
                {doc.ciot?.error_message && (
                  <Row label="Erro" value={doc.ciot.error_message} />
                )}
              </div>
              {!ciotOk &&
                doc.status !== "cancelado" &&
                typeof onRegistrarCiot === "function" && (
                  <Button
                    type="button"
                    variant="primary"
                    loading={registrandoCiot}
                    onClick={onRegistrarCiot}
                  >
                    Registrar CIOT
                  </Button>
                )}
            </div>
          )}

          {doc && (tipo === "cte" || tipo === "mdfe") && (
            <AverbacaoStatusCard
              averbacao={averbacao}
              tipo={tipo}
              documentoId={doc.id}
              onUpdated={setAverbacao}
            />
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
  tipo: PropTypes.oneOf(["cte", "mdfe", "ciot", "contrato"]),
  erro: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onRegistrarCiot: PropTypes.func,
  registrandoCiot: PropTypes.bool,
};
