import React, { useState } from "react";
import PropTypes from "prop-types";
import { Alert, Button } from "../ui";
import { getStatusConfig } from "../../utils/statusColors.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../../utils/permissions.js";
import { apiFetch, parseApiError } from "../../lib/apiClient.js";
import {
  averbacaoIsErro,
  averbacaoIsOk,
  averbacaoPodeReprocessar,
  averbacaoProviderLabel,
  averbacaoStatusLabel,
} from "../../utils/averbacaoLabels.js";

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("pt-BR");
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
 * Seção Seguro / Averbação no detalhe do CT-e ou MDF-e.
 * Não mostra senha, token nem XML.
 */
export default function AverbacaoStatusCard({
  averbacao,
  tipo = "cte",
  documentoId,
  onUpdated,
  canWrite,
}) {
  const { user } = useAuth();
  const write =
    canWrite ??
    (userHasPermission(user, PERMISSIONS.CTE_WRITE) ||
      userHasPermission(user, PERMISSIONS.MDFE_WRITE));
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [detalheAberto, setDetalheAberto] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    setErro("");
    try {
      const data = await fn();
      onUpdated?.(data);
    } catch (err) {
      const parsed = await parseApiError(err);
      setErro(parsed.message || "Falha na operação de averbação");
    } finally {
      setBusy(false);
    }
  };

  const handleSolicitar = () =>
    run(async () => {
      const res = await apiFetch({
        method: "POST",
        url: "/fiscal/seguro/averbacoes",
        data: tipo === "mdfe" ? { mdfe_id: documentoId } : { cte_id: documentoId },
      });
      return res.data ?? res;
    });

  const handleReprocessar = () =>
    run(async () => {
      const res = await apiFetch({
        method: "POST",
        url: `/fiscal/seguro/averbacoes/${averbacao.id}/reprocessar`,
      });
      return res.data ?? res;
    });

  const handleConsultar = () =>
    run(async () => {
      const res = await apiFetch({
        method: "POST",
        url: `/fiscal/seguro/averbacoes/${averbacao.id}/consultar`,
      });
      return res.data ?? res;
    });

  if (!averbacao) {
    return (
      <div className="rounded-lg border border-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-primary">Seguro / Averbação</h3>
          <span className="text-xs text-text-secondary">Não enviado</span>
        </div>
        <p className="text-sm text-text-secondary">
          Nenhuma averbação registrada para este documento. Se a averbação
          automática estiver ligada, o envio ocorre após a autorização na SEFAZ.
        </p>
        {write && documentoId ? (
          <Button type="button" size="sm" loading={busy} onClick={handleSolicitar}>
            Averbar agora
          </Button>
        ) : null}
        {erro && <Alert type="error" message={erro} />}
      </div>
    );
  }

  const ok = averbacaoIsOk(averbacao.status);
  const falha = averbacaoIsErro(averbacao.status);

  return (
    <div className="rounded-lg border border-border px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary">Seguro / Averbação</h3>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusConfig(averbacao.status)}`}
        >
          {ok ? "🟢 " : falha ? "🔴 " : ""}
          {averbacaoStatusLabel(averbacao.status)}
        </span>
      </div>
      <div>
        <Row label="Provedor" value={averbacaoProviderLabel(averbacao.provider)} />
        <Row label="Seguradora" value={averbacao.seguradora || "—"} />
        <Row label="Apólice" value={averbacao.numero_apolice || "—"} />
        <Row label="Averbação" value={averbacao.numero_averbacao || "—"} />
        <Row label="Protocolo" value={averbacao.protocolo || "—"} />
        <Row label="Ambiente" value={averbacao.ambiente === "producao" ? "Produção" : "Homologação"} />
        <Row
          label="Data"
          value={fmtDate(averbacao.averbed_at || averbacao.atualizado_em)}
        />
      </div>
      {falha && averbacao.error_message && detalheAberto && (
        <Alert type="error" title="Detalhe da averbadora">
          <p className="text-xs whitespace-pre-wrap">
            {averbacao.error_code ? `${averbacao.error_code} — ` : ""}
            {averbacao.error_message}
          </p>
        </Alert>
      )}
      {erro && <Alert type="error" message={erro} />}
      <div className="flex flex-wrap gap-2">
        {falha && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setDetalheAberto((v) => !v)}
          >
            {detalheAberto ? "Ocultar detalhes" : "Ver detalhes"}
          </Button>
        )}
        {averbacao.id && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={handleConsultar}
          >
            Consultar
          </Button>
        )}
        {write && averbacaoPodeReprocessar(averbacao.status) && (
          <Button type="button" size="sm" loading={busy} onClick={handleReprocessar}>
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}

AverbacaoStatusCard.propTypes = {
  averbacao: PropTypes.object,
  tipo: PropTypes.oneOf(["cte", "mdfe"]),
  documentoId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onUpdated: PropTypes.func,
  canWrite: PropTypes.bool,
};
