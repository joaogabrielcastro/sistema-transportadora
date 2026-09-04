import React, { useState } from "react";
import PropTypes from "prop-types";
import { Alert, Button, Modal, StatusBadge } from "../ui";

const STATUS_BADGE = {
  ok: "processado",
  pronto: "processado",
  simulado: "processando",
  pendente: "pendente",
};

function rotuloTipo(tipo) {
  if (tipo === "mdfe") return "MDF-e";
  if (tipo === "ciot") return "CIOT";
  return "CT-e";
}

/**
 * Resultado do modo demonstração (CT-e / MDF-e / CIOT): pipeline visual +
 * payload, sem transmissão à SEFAZ/ANTT.
 */
export default function FiscalSimulacaoModal({
  isOpen,
  onClose,
  loading = false,
  resultado = null,
  erro = null,
}) {
  const [mostrarPayload, setMostrarPayload] = useState(false);
  const isCiot = resultado?.tipo === "ciot";
  const tipo = rotuloTipo(resultado?.tipo);
  const dacte = resultado?.tipo === "mdfe" ? "DAMDFE" : "DACTE";
  const etapas = resultado?.etapas || [];
  const payload = isCiot
    ? resultado?.payload_ciot
    : resultado?.payload_brasil_nfe;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isCiot
          ? `Simulação de declaração — ${tipo}`
          : `Simulação de emissão — ${tipo}`
      }
      size="lg"
    >
      <div className="space-y-4">
        {erro && (
          <Alert type="error" title="Validação">
            {erro}
          </Alert>
        )}

        {loading && (
          <p className="text-sm text-text-secondary">
            Validando e montando o payload…
          </p>
        )}

        {resultado && (
          <>
            <Alert
              type="warning"
              title={isCiot ? "Não foi enviado à ANTT" : "Não foi enviado à SEFAZ"}
            >
              {resultado.aviso}
              {resultado.pendencias?.certificado_a1
                ? isCiot
                  ? " A declaração na ANTT está pendente do certificado A1 do cliente."
                  : " Autorização SEFAZ está pendente do certificado A1 do cliente."
                : isCiot
                  ? " Com o A1 cadastrado, o botão Declarar faz a transmissão de verdade."
                  : " Com o A1 cadastrado, o botão Emitir faz a transmissão de verdade."}
            </Alert>

            <ol className="space-y-2">
              {etapas.map((etapa, index) => (
                <li
                  key={etapa.id}
                  className="flex gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <span className="mt-0.5 w-6 shrink-0 text-sm font-semibold text-text-secondary">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {etapa.label}
                      </span>
                      <StatusBadge
                        status={STATUS_BADGE[etapa.status] || "pendente"}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {etapa.detalhe}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMostrarPayload((v) => !v)}
              >
                {mostrarPayload
                  ? isCiot
                    ? "Ocultar payload CIOT"
                    : "Ocultar payload Brasil NFe"
                  : "Ver payload que seria enviado"}
              </Button>
              {mostrarPayload && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 text-xs leading-relaxed">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              )}
            </div>

            <p className="text-xs text-text-secondary">
              {isCiot
                ? "Número CIOT, protocolo e comprovante não são gerados neste modo."
                : `Chave de acesso, protocolo e ${dacte} não são gerados neste modo.`}
              {resultado.documento?.id
                ? ` Rascunho #${resultado.documento.id} permanece salvo para emitir depois.`
                : ""}
            </p>
          </>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

FiscalSimulacaoModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  loading: PropTypes.bool,
  resultado: PropTypes.object,
  erro: PropTypes.string,
};
