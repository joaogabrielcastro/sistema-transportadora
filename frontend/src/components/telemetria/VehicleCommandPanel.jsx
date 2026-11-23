import React, { useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Button, Modal } from "../ui";
import Icon from "../ui/Icon.jsx";
import { useToast } from "../ui/useToast.js";
import { parseApiError } from "../../lib/apiClient.js";
import {
  useCreateTelemetryCommandMutation,
  useTelemetryCommandsQuery,
} from "../../hooks/queries/useTelemetryQueries.js";
import { relativeTime } from "../../utils/telemetryDisplay.js";

/** Mesmo limite do servidor: bloqueio só com o veículo parado. */
const BLOCK_MAX_SPEED_KMH = 5;

const STATUS = {
  pendente: { label: "Aguardando o rastreador", tone: "text-amber-700" },
  enviado: { label: "Enviado, aguardando resposta", tone: "text-amber-700" },
  executado: { label: "Executado pelo rastreador", tone: "text-emerald-700" },
  falhou: { label: "Falhou", tone: "text-red-700" },
  recusado: { label: "Recusado", tone: "text-red-700" },
  expirado: { label: "Expirou sem conexão", tone: "text-red-700" },
};

/**
 * Bloqueio/desbloqueio do motor pelo rastreador (somente administradores).
 * O servidor confere de novo se o veículo está parado antes de enviar.
 */
export default function VehicleCommandPanel({
  caminhaoId,
  placa,
  speedKmh,
  now,
}) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(null); // "bloquear" | "desbloquear" | null
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const create = useCreateTelemetryCommandMutation();
  const { data: commands = [] } = useTelemetryCommandsQuery(
    { caminhao_id: caminhaoId, limit: 5 },
    { refetchInterval: 3000 },
  );
  const last = commands[0] || null;
  const inFlight =
    last && (last.status === "pendente" || last.status === "enviado");
  const moving = speedKmh != null && speedKmh > BLOCK_MAX_SPEED_KMH;
  const blocked = last?.acao === "bloquear" && last?.status === "executado";

  const close = () => {
    if (create.isPending) return;
    setConfirming(null);
    setTyped("");
    setError("");
  };

  const submit = async () => {
    setError("");
    try {
      await create.mutateAsync({ caminhao_id: caminhaoId, acao: confirming });
      toast.success(
        confirming === "bloquear"
          ? "Bloqueio pedido. Aguardando o rastreador."
          : "Desbloqueio pedido. Aguardando o rastreador.",
      );
      setConfirming(null);
      setTyped("");
    } catch (err) {
      setError((await parseApiError(err)).message);
    }
  };

  const plateOk =
    typed.replace(/[^a-z0-9]/gi, "").toUpperCase() ===
    String(placa || "")
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase();

  return (
    <div className="mt-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-text-primary">
          <Icon
            name="shield"
            className="mr-1 inline h-3.5 w-3.5 align-[-2px]"
          />
          Bloqueio do motor
        </p>
        {blocked ? (
          <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-200">
            Bloqueado
          </span>
        ) : null}
      </div>
      {last ? (
        <p className="mt-1 text-[11px] text-text-secondary">
          {last.acao === "bloquear" ? "Bloqueio" : "Desbloqueio"} ·{" "}
          <span className={STATUS[last.status]?.tone || ""}>
            {STATUS[last.status]?.label || last.status}
          </span>
          {" · "}
          {relativeTime(last.criado_em, now)}
          {last.criado_por_nome ? ` · ${last.criado_por_nome}` : ""}
          {last.erro ? (
            <span className="block text-red-700">{last.erro}</span>
          ) : null}
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-text-secondary">
          Nenhum comando enviado.
        </p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={inFlight || moving}
          title={
            moving ? "Só é possível bloquear com o veículo parado" : undefined
          }
          onClick={() => setConfirming("bloquear")}
          className="!text-red-700"
        >
          Bloquear
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={inFlight}
          onClick={() => setConfirming("desbloquear")}
        >
          Desbloquear
        </Button>
      </div>
      {moving ? (
        <p className="mt-1.5 text-[11px] text-text-secondary">
          Bloqueio disponível só com o veículo parado.
        </p>
      ) : null}

      {/* Portal: o painel de detalhe usa backdrop-blur, que prenderia o modal dentro dele. */}
      {createPortal(
        <Modal
          isOpen={Boolean(confirming)}
          onClose={close}
          title={
            confirming === "bloquear"
              ? `Bloquear o motor de ${placa}?`
              : `Desbloquear o motor de ${placa}?`
          }
          size="md"
        >
          {confirming === "bloquear" ? (
            <div className="space-y-3 text-sm text-text-secondary">
              <p>
                O rastreador aciona o relé de bloqueio: o caminhão{" "}
                <b>não vai dar partida</b> até ser desbloqueado. O comando só é
                enviado se o veículo continuar parado e expira se o rastreador
                não estiver conectado em 2 minutos.
              </p>
              <label className="block">
                <span className="text-xs font-semibold text-text-primary">
                  Digite a placa para confirmar
                </span>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={placa}
                  autoComplete="off"
                  className="mt-1 h-10 w-full rounded-lg border border-border px-3 uppercase text-text-primary"
                />
              </label>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              O rastreador desliga o relé e o caminhão volta a dar partida
              normalmente.
            </p>
          )}
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={create.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={submit}
              loading={create.isPending}
              disabled={confirming === "bloquear" && !plateOk}
              className={
                confirming === "bloquear" ? "!bg-red-600 hover:!bg-red-700" : ""
              }
            >
              {confirming === "bloquear" ? "Bloquear motor" : "Desbloquear"}
            </Button>
          </div>
        </Modal>,
        document.body,
      )}
    </div>
  );
}

VehicleCommandPanel.propTypes = {
  caminhaoId: PropTypes.number.isRequired,
  placa: PropTypes.string,
  speedKmh: PropTypes.number,
  now: PropTypes.number,
};
