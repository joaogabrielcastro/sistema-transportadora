import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, FormField, Modal } from "../ui";
import { apiFetch, parseApiError } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray } from "../../utils/extractApiArray.js";
import { useToast } from "../ui/useToast.js";
import { despesaPayload, useViagemMutation } from "../../hooks/queries/useViagensQueries.js";
import { fmtKm, fromLocalInput, toLocalInput } from "../../utils/viagens.js";

/** Os modais ficam em document.body: evita ficarem presos em painéis com blur/overflow. */
function Portal({ children }) {
  return createPortal(children, document.body);
}

function useOpcoesViagem(enabled) {
  const caminhoes = useQuery({
    queryKey: queryKeys.caminhoes.list({ page: 1, limit: 200, uso: "viagem" }),
    enabled,
    queryFn: async () => extractApiArray(await apiFetch({ method: "GET", url: "/caminhoes", params: { page: 1, limit: 200 } })),
  });
  const motoristas = useQuery({
    queryKey: queryKeys.motoristas.list({ ativo: true }),
    enabled,
    queryFn: async () => extractApiArray(await apiFetch({ method: "GET", url: "/motoristas", params: { ativo: true } })),
  });
  return {
    caminhoes: (caminhoes.data || []).filter((c) => c.tipo_veiculo !== "carreta"),
    motoristas: (motoristas.data || []).filter((m) => m.ativo !== false),
    loading: caminhoes.isLoading || motoristas.isLoading,
  };
}

function useTiposGasto(enabled = true) {
  return useQuery({
    queryKey: queryKeys.manutencaoMeta.tipos,
    enabled,
    queryFn: async () => extractApiArray(await apiFetch({ method: "GET", url: "/tipos-gastos" })),
  });
}

function ModalActions({ onCancel, busy, submitLabel, disabled, danger }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
        Cancelar
      </Button>
      <Button
        type="submit"
        loading={busy}
        disabled={disabled}
        className={danger ? "!bg-red-600 hover:!bg-red-700" : ""}
      >
        {submitLabel}
      </Button>
    </div>
  );
}

ModalActions.propTypes = {
  onCancel: PropTypes.func.isRequired,
  busy: PropTypes.bool,
  submitLabel: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  danger: PropTypes.bool,
};

/** Etapa 1: nova viagem (inicia na hora ou fica planejada). */
export function NovaViagemModal({ isOpen, onClose, onCreated, canStart, defaults = {} }) {
  const toast = useToast();
  const mutation = useViagemMutation();
  const { caminhoes, motoristas, loading } = useOpcoesViagem(isOpen);
  const blank = () => ({
    caminhao_id: defaults.caminhao_id ? String(defaults.caminhao_id) : "",
    motorista_id: "",
    saida_em: toLocalInput(),
    origem: "",
    destino: "",
    km_inicial: "",
    observacoes: "",
    iniciar: canStart,
  });
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setForm(blank());
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const caminhao = caminhoes.find((c) => String(c.id) === String(form.caminhao_id));
  // Km inicial sugerido: o odômetro atual do caminhão.
  useEffect(() => {
    if (caminhao && form.km_inicial === "") {
      setForm((f) => ({ ...f, km_inicial: String(caminhao.km_atual ?? 0) }));
    }
  }, [caminhao, form.km_inicial]);

  // O motorista vinculado ao caminhão vem preenchido.
  useEffect(() => {
    if (caminhao?.motorista_id && !form.motorista_id) {
      setForm((f) => ({ ...f, motorista_id: String(caminhao.motorista_id) }));
    }
  }, [caminhao, form.motorista_id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const kmAbaixo = caminhao && form.km_inicial !== "" && Number(form.km_inicial) < Number(caminhao.km_atual || 0);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const data = await mutation.mutateAsync({
        method: "POST",
        url: "/viagens",
        data: {
          caminhao_id: Number(form.caminhao_id),
          motorista_id: Number(form.motorista_id),
          saida_em: fromLocalInput(form.saida_em),
          origem: form.origem.trim(),
          destino: form.destino.trim(),
          km_inicial: Number(form.km_inicial),
          observacoes: form.observacoes.trim() || null,
          iniciar: Boolean(form.iniciar),
        },
      });
      toast.success(form.iniciar ? `Viagem nº ${data.numero} iniciada` : `Viagem nº ${data.numero} planejada`);
      onCreated?.(data);
      onClose();
    } catch (err) {
      setError((await parseApiError(err)).message);
    }
  };

  return (
    <Portal>
      <Modal isOpen={isOpen} onClose={mutation.isPending ? undefined : onClose} title="Nova viagem" size="lg">
        <form onSubmit={submit} className="space-y-4">
          {error ? <Alert type="error" message={error} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Caminhão"
              name="caminhao_id"
              type="searchable"
              value={form.caminhao_id}
              onChange={set("caminhao_id")}
              options={caminhoes.map((c) => ({
                value: String(c.id),
                label: [c.placa, c.modelo || c.marca].filter(Boolean).join(" · "),
              }))}
              placeholder={loading ? "Carregando…" : "Placa ou modelo"}
              required
            />
            <FormField
              label="Motorista responsável"
              name="motorista_id"
              type="searchable"
              value={form.motorista_id}
              onChange={set("motorista_id")}
              options={motoristas.map((m) => ({ value: String(m.id), label: m.nome }))}
              placeholder={loading ? "Carregando…" : "Nome do motorista"}
              helperText={!loading && motoristas.length === 0 ? "Cadastre motoristas em Frota → Motoristas." : undefined}
              required
            />
            <FormField label="Origem" name="origem" value={form.origem} onChange={set("origem")} placeholder="Cidade - UF ou local" maxLength={160} required />
            <FormField label="Destino" name="destino" value={form.destino} onChange={set("destino")} placeholder="Cidade - UF ou cliente" maxLength={160} required />
            <FormField label="Data e hora de saída" name="saida_em" type="datetime-local" value={form.saida_em} onChange={set("saida_em")} required />
            <FormField
              label="Km inicial"
              name="km_inicial"
              type="number"
              decimals={0}
              min={0}
              value={form.km_inicial}
              onChange={set("km_inicial")}
              helperText={
                kmAbaixo
                  ? `Abaixo do odômetro cadastrado (${fmtKm(caminhao.km_atual)}). Confira antes de salvar.`
                  : caminhao
                    ? `Odômetro cadastrado: ${fmtKm(caminhao.km_atual)}`
                    : undefined
              }
              required
            />
          </div>
          <FormField
            label="Observações (opcional)"
            name="observacoes"
            type="textarea"
            rows={2}
            value={form.observacoes}
            onChange={set("observacoes")}
            maxLength={2000}
          />
          {canStart ? (
            <label className="flex items-start gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-border"
                checked={form.iniciar}
                onChange={(e) => setForm((f) => ({ ...f, iniciar: e.target.checked }))}
              />
              <span>
                <b className="text-text-primary">Iniciar agora</b> — a viagem fica <i>em andamento</i>. Desmarque para só
                planejar e iniciar depois.
              </span>
            </label>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-text-secondary">
              A viagem será salva como <b>planejada</b>. Quem tem permissão de iniciar viagens dá a saída.
            </p>
          )}
          <ModalActions
            onCancel={onClose}
            busy={mutation.isPending}
            submitLabel={form.iniciar ? "Iniciar viagem" : "Salvar planejada"}
            disabled={!form.caminhao_id || !form.motorista_id}
          />
        </form>
      </Modal>
    </Portal>
  );
}

NovaViagemModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func,
  canStart: PropTypes.bool,
  defaults: PropTypes.object,
};

/** Etapa 3: encerramento. */
export function EncerrarViagemModal({ viagem, isOpen, onClose }) {
  const toast = useToast();
  const mutation = useViagemMutation();
  const [form, setForm] = useState({ chegada_em: toLocalInput(), km_final: "", observacoes_encerramento: "", ocorrencias: "" });
  const [error, setError] = useState("");
  useEffect(() => {
    if (isOpen) {
      setForm({ chegada_em: toLocalInput(), km_final: "", observacoes_encerramento: "", ocorrencias: "" });
      setError("");
    }
  }, [isOpen]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const km = form.km_final === "" ? null : Number(form.km_final) - Number(viagem?.km_inicial || 0);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await mutation.mutateAsync({
        method: "POST",
        url: `/viagens/${viagem.id}/encerrar`,
        data: {
          chegada_em: fromLocalInput(form.chegada_em),
          km_final: Number(form.km_final),
          observacoes_encerramento: form.observacoes_encerramento.trim() || null,
          ocorrencias: form.ocorrencias.trim() || null,
        },
      });
      toast.success(`Viagem nº ${viagem.numero} finalizada`);
      onClose();
    } catch (err) {
      setError((await parseApiError(err)).message);
    }
  };

  if (!viagem) return null;
  return (
    <Portal>
      <Modal isOpen={isOpen} onClose={mutation.isPending ? undefined : onClose} title={`Encerrar viagem nº ${viagem.numero}`} size="lg">
        <form onSubmit={submit} className="space-y-4">
          {error ? <Alert type="error" message={error} /> : null}
          <p className="text-sm text-text-secondary">
            {viagem.caminhao?.placa} · {viagem.origem} → {viagem.destino} · saída com {fmtKm(viagem.km_inicial)}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Data e hora de chegada" name="chegada_em" type="datetime-local" value={form.chegada_em} onChange={set("chegada_em")} required />
            <FormField
              label="Km final"
              name="km_final"
              type="number"
              decimals={0}
              min={Number(viagem.km_inicial || 0)}
              value={form.km_final}
              onChange={set("km_final")}
              helperText={
                km == null ? `Mínimo ${fmtKm(viagem.km_inicial)}` : km < 0 ? "Menor que o km inicial" : `Percorrido: ${fmtKm(km)}`
              }
              error={km != null && km < 0 ? "Km final menor que o inicial" : undefined}
              required
            />
          </div>
          <FormField
            label="Ocorrências (opcional)"
            name="ocorrencias"
            type="textarea"
            rows={2}
            value={form.ocorrencias}
            onChange={set("ocorrencias")}
            placeholder="Avaria, atraso, multa, acidente, carga recusada…"
            helperText="Viagens com ocorrência aparecem destacadas no painel."
            maxLength={2000}
          />
          <FormField
            label="Observações sobre a viagem (opcional)"
            name="observacoes_encerramento"
            type="textarea"
            rows={2}
            value={form.observacoes_encerramento}
            onChange={set("observacoes_encerramento")}
            maxLength={2000}
          />
          <ModalActions onCancel={onClose} busy={mutation.isPending} submitLabel="Encerrar viagem" disabled={form.km_final === "" || (km != null && km < 0)} />
        </form>
      </Modal>
    </Portal>
  );
}

EncerrarViagemModal.propTypes = { viagem: PropTypes.object, isOpen: PropTypes.bool, onClose: PropTypes.func.isRequired };

/** Edição dos dados da viagem (campos conforme a situação). */
export function EditarViagemModal({ viagem, isOpen, onClose }) {
  const toast = useToast();
  const mutation = useViagemMutation();
  const { motoristas, caminhoes } = useOpcoesViagem(isOpen);
  const initial = useMemo(
    () =>
      viagem
        ? {
            caminhao_id: String(viagem.caminhao?.id ?? ""),
            motorista_id: String(viagem.motorista?.id ?? ""),
            origem: viagem.origem || "",
            destino: viagem.destino || "",
            saida_em: toLocalInput(viagem.saida_em),
            km_inicial: String(viagem.km_inicial ?? ""),
            observacoes: viagem.observacoes || "",
            chegada_em: viagem.chegada_em ? toLocalInput(viagem.chegada_em) : "",
            km_final: viagem.km_final != null ? String(viagem.km_final) : "",
            ocorrencias: viagem.ocorrencias || "",
            observacoes_encerramento: viagem.observacoes_encerramento || "",
            motivo: "",
          }
        : null,
    [viagem],
  );
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  useEffect(() => {
    if (isOpen) {
      setForm(initial);
      setError("");
    }
  }, [isOpen, initial]);
  if (!viagem || !form) return null;
  const finalizada = viagem.status === "finalizada";
  const planejada = viagem.status === "planejada";
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const body = {};
    const put = (k, v, orig) => {
      if (String(v ?? "") !== String(orig ?? "")) body[k] = v;
    };
    if (planejada) put("caminhao_id", Number(form.caminhao_id), viagem.caminhao?.id);
    put("motorista_id", Number(form.motorista_id), viagem.motorista?.id);
    put("origem", form.origem.trim(), viagem.origem);
    put("destino", form.destino.trim(), viagem.destino);
    if (fromLocalInput(form.saida_em) !== toIsoMinute(viagem.saida_em)) body.saida_em = fromLocalInput(form.saida_em);
    put("km_inicial", Number(form.km_inicial), viagem.km_inicial);
    put("observacoes", form.observacoes.trim() || null, viagem.observacoes);
    if (finalizada) {
      if (fromLocalInput(form.chegada_em) !== toIsoMinute(viagem.chegada_em)) body.chegada_em = fromLocalInput(form.chegada_em);
      put("km_final", Number(form.km_final), viagem.km_final);
      put("ocorrencias", form.ocorrencias.trim() || null, viagem.ocorrencias);
      put("observacoes_encerramento", form.observacoes_encerramento.trim() || null, viagem.observacoes_encerramento);
    }
    if (!Object.keys(body).length) {
      onClose();
      return;
    }
    if (form.motivo.trim()) body.motivo = form.motivo.trim();
    try {
      await mutation.mutateAsync({ method: "PATCH", url: `/viagens/${viagem.id}`, data: body });
      toast.success("Viagem atualizada");
      onClose();
    } catch (err) {
      setError((await parseApiError(err)).message);
    }
  };

  return (
    <Portal>
      <Modal isOpen={isOpen} onClose={mutation.isPending ? undefined : onClose} title={`Editar viagem nº ${viagem.numero}`} size="lg">
        <form onSubmit={submit} className="space-y-4">
          {error ? <Alert type="error" message={error} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {planejada ? (
              <FormField
                label="Caminhão"
                name="caminhao_id"
                type="searchable"
                value={form.caminhao_id}
                onChange={set("caminhao_id")}
                options={caminhoes.map((c) => ({ value: String(c.id), label: c.placa }))}
                required
              />
            ) : null}
            <FormField
              label="Motorista responsável"
              name="motorista_id"
              type="searchable"
              value={form.motorista_id}
              onChange={set("motorista_id")}
              options={[
                ...motoristas.map((m) => ({ value: String(m.id), label: m.nome })),
                ...(viagem.motorista?.id && !motoristas.some((m) => m.id === viagem.motorista.id)
                  ? [{ value: String(viagem.motorista.id), label: viagem.motorista.nome }]
                  : []),
              ]}
              required
            />
            <FormField label="Origem" name="origem" value={form.origem} onChange={set("origem")} maxLength={160} required />
            <FormField label="Destino" name="destino" value={form.destino} onChange={set("destino")} maxLength={160} required />
            <FormField label="Saída" name="saida_em" type="datetime-local" value={form.saida_em} onChange={set("saida_em")} required />
            <FormField label="Km inicial" name="km_inicial" type="number" decimals={0} min={0} value={form.km_inicial} onChange={set("km_inicial")} required />
            {finalizada ? (
              <>
                <FormField label="Chegada" name="chegada_em" type="datetime-local" value={form.chegada_em} onChange={set("chegada_em")} required />
                <FormField label="Km final" name="km_final" type="number" decimals={0} min={0} value={form.km_final} onChange={set("km_final")} required />
              </>
            ) : null}
          </div>
          <FormField label="Observações" name="observacoes" type="textarea" rows={2} value={form.observacoes} onChange={set("observacoes")} maxLength={2000} />
          {finalizada ? (
            <>
              <FormField label="Ocorrências" name="ocorrencias" type="textarea" rows={2} value={form.ocorrencias} onChange={set("ocorrencias")} maxLength={2000} />
              <FormField
                label="Observações do encerramento"
                name="observacoes_encerramento"
                type="textarea"
                rows={2}
                value={form.observacoes_encerramento}
                onChange={set("observacoes_encerramento")}
                maxLength={2000}
              />
            </>
          ) : null}
          <FormField
            label={finalizada ? "Motivo da alteração" : "Motivo da alteração (opcional)"}
            name="motivo"
            value={form.motivo}
            onChange={set("motivo")}
            helperText="Fica registrado no histórico da viagem."
            maxLength={500}
            required={finalizada}
          />
          <ModalActions onCancel={onClose} busy={mutation.isPending} submitLabel="Salvar alterações" />
        </form>
      </Modal>
    </Portal>
  );
}

EditarViagemModal.propTypes = { viagem: PropTypes.object, isOpen: PropTypes.bool, onClose: PropTypes.func.isRequired };

function toIsoMinute(iso) {
  if (!iso) return null;
  return fromLocalInput(toLocalInput(iso));
}

/** Etapa 2: despesa (registrar ou editar). */
export function DespesaModal({ viagem, despesa, isOpen, onClose, financeiroVisivel }) {
  const toast = useToast();
  const mutation = useViagemMutation();
  const tipos = useTiposGasto(isOpen);
  const editing = Boolean(despesa);
  const initial = () => ({
    tipo_gasto_id: despesa?.tipo_gasto_id ? String(despesa.tipo_gasto_id) : "",
    descricao: despesa?.descricao || "",
    valor: despesa?.valor != null ? String(despesa.valor) : "",
    registrado_em: toLocalInput(despesa?.registrado_em || new Date()),
    quantidade_combustivel: despesa?.quantidade_combustivel != null ? String(despesa.quantidade_combustivel) : "",
    km_registro: despesa?.km_registro != null ? String(despesa.km_registro) : "",
    motivo: "",
  });
  const [form, setForm] = useState(initial);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (isOpen) {
      setForm(initial());
      setFile(null);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, despesa]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const tipoNome = (tipos.data || []).find((t) => String(t.id) === form.tipo_gasto_id)?.nome_tipo || "";
  const isCombustivel = /combust/i.test(tipoNome);
  // Sem acesso financeiro, quem edita não vê o valor atual: só troca se digitar um novo.
  const valorOculto = editing && despesa?.valor == null;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const values = { ...form, registrado_em: fromLocalInput(form.registrado_em) };
    if (!isCombustivel) values.quantidade_combustivel = "";
    try {
      const { data, headers } = despesaPayload(values, file);
      if (editing && valorOculto && !form.valor) {
        if (data instanceof FormData) data.delete("valor");
        else delete data.valor;
      }
      await mutation.mutateAsync({
        method: editing ? "PATCH" : "POST",
        url: editing ? `/viagens/${viagem.id}/despesas/${despesa.id}` : `/viagens/${viagem.id}/despesas`,
        data,
        headers,
      });
      toast.success(editing ? "Despesa atualizada" : "Despesa registrada");
      onClose();
    } catch (err) {
      setError((await parseApiError(err)).message);
    }
  };

  if (!viagem) return null;
  return (
    <Portal>
      <Modal
        isOpen={isOpen}
        onClose={mutation.isPending ? undefined : onClose}
        title={editing ? "Editar despesa" : `Registrar despesa — viagem nº ${viagem.numero}`}
        size="lg"
      >
        <form onSubmit={submit} className="space-y-4">
          {error ? <Alert type="error" message={error} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Categoria"
              name="tipo_gasto_id"
              type="select"
              value={form.tipo_gasto_id}
              onChange={set("tipo_gasto_id")}
              options={(tipos.data || []).map((t) => ({ value: String(t.id), label: t.nome_tipo }))}
              placeholder={tipos.isLoading ? "Carregando…" : "Selecione"}
              required
            />
            <FormField
              label="Valor (R$)"
              name="valor"
              type="number"
              decimals={2}
              min={0}
              value={form.valor}
              onChange={set("valor")}
              placeholder={valorOculto ? "Valor oculto — digite para trocar" : "0,00"}
              helperText={!financeiroVisivel && !editing ? "Depois de salvo, o valor só aparece para quem tem acesso financeiro." : undefined}
              required={!valorOculto}
            />
            <FormField label="Data e hora" name="registrado_em" type="datetime-local" value={form.registrado_em} onChange={set("registrado_em")} required />
            {isCombustivel ? (
              <FormField
                label="Litros (opcional)"
                name="quantidade_combustivel"
                type="number"
                decimals={2}
                min={0}
                value={form.quantidade_combustivel}
                onChange={set("quantidade_combustivel")}
              />
            ) : null}
            <FormField
              label="Km no lançamento (opcional)"
              name="km_registro"
              type="number"
              decimals={0}
              min={0}
              value={form.km_registro}
              onChange={set("km_registro")}
              helperText="Se maior, atualiza o odômetro do caminhão."
            />
          </div>
          <FormField
            label="Descrição"
            name="descricao"
            value={form.descricao}
            onChange={set("descricao")}
            placeholder="Ex.: Diesel S10 posto BR-116, pedágio Régis Bittencourt"
            maxLength={500}
            required
          />
          <div>
            <label htmlFor="comprovante" className="mb-1.5 block text-sm font-medium text-text-primary">
              Comprovante {editing && despesa?.tem_comprovante ? "(enviar outro substitui o atual)" : "(opcional)"}
            </label>
            <input
              id="comprovante"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-text-primary hover:file:bg-slate-200"
            />
            <p className="mt-1 text-xs text-text-light">PDF ou foto (JPG, PNG, WEBP), até 10 MB.</p>
            {file && file.size > 10 * 1024 * 1024 ? (
              <p className="mt-1 text-xs text-red-700">Arquivo maior que 10 MB.</p>
            ) : null}
          </div>
          {editing ? (
            <FormField
              label="Motivo da alteração (opcional)"
              name="motivo"
              value={form.motivo}
              onChange={set("motivo")}
              helperText="Fica registrado no histórico da viagem."
              maxLength={500}
            />
          ) : null}
          <ModalActions
            onCancel={onClose}
            busy={mutation.isPending}
            submitLabel={editing ? "Salvar despesa" : "Registrar despesa"}
            disabled={Boolean(file && file.size > 10 * 1024 * 1024)}
          />
        </form>
      </Modal>
    </Portal>
  );
}

DespesaModal.propTypes = {
  viagem: PropTypes.object,
  despesa: PropTypes.object,
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  financeiroVisivel: PropTypes.bool,
};

/** Ação que exige motivo (cancelar viagem, excluir despesa). */
export function MotivoModal({ isOpen, onClose, title, description, confirmLabel, request, successMessage }) {
  const toast = useToast();
  const mutation = useViagemMutation();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (isOpen) {
      setMotivo("");
      setError("");
    }
  }, [isOpen]);
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await mutation.mutateAsync({ ...request, data: { motivo: motivo.trim() } });
      toast.success(successMessage);
      onClose();
    } catch (err) {
      setError((await parseApiError(err)).message);
    }
  };
  return (
    <Portal>
      <Modal isOpen={isOpen} onClose={mutation.isPending ? undefined : onClose} title={title} size="md">
        <form onSubmit={submit} className="space-y-4">
          {error ? <Alert type="error" message={error} /> : null}
          <p className="text-sm text-text-secondary">{description}</p>
          <FormField
            label="Motivo"
            name="motivo"
            type="textarea"
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            required
          />
          <ModalActions onCancel={onClose} busy={mutation.isPending} submitLabel={confirmLabel} disabled={motivo.trim().length < 3} danger />
        </form>
      </Modal>
    </Portal>
  );
}

MotivoModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.node,
  confirmLabel: PropTypes.string.isRequired,
  request: PropTypes.object,
  successMessage: PropTypes.string,
};
