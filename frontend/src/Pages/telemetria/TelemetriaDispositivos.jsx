import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageLayout from "../../components/layout/PageLayout.jsx";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  DataTableTd,
  DataTableTh,
  FormField,
  Modal,
  PageHeader,
  StatCard,
} from "../../components/ui";
import Icon from "../../components/ui/Icon.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import { TableSkeleton } from "../../components/Skeleton.jsx";
import { useToast } from "../../components/ui/useToast.js";
import { parseApiError } from "../../lib/apiClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../../utils/permissions.js";
import { relativeTime } from "../../utils/telemetryDisplay.js";
import { useCaminhoesListQuery } from "../../hooks/queries/useCaminhoesQuery.js";
import {
  useAssignTelemetryDeviceMutation,
  useCreateTelemetryDeviceMutation,
  useRevokeTelemetryDeviceMutation,
  useRotateTelemetryCredentialMutation,
  useTelemetryDevicesQuery,
  useUnassignTelemetryDeviceMutation,
  useUpdateTelemetryDeviceMutation,
} from "../../hooks/queries/useTelemetryQueries.js";

const CONNECTION = {
  online: { label: "Online", dot: "bg-emerald-500", text: "text-emerald-700" },
  offline: { label: "Sem sinal", dot: "bg-red-500", text: "text-red-700" },
  awaiting: { label: "Aguardando 1º sinal", dot: "bg-slate-300", text: "text-slate-600" },
  revoked: { label: "Revogado", dot: "bg-slate-400", text: "text-slate-500" },
};

const PROTOCOL_LABEL = {
  teltonika: "Teltonika (TCP)",
  http_json: "API ATrack (HTTP)",
};

const OWNERSHIP_LABEL = { CUSTOMER: "Do cliente", ATRACK: "ATrack" };

const emptyForm = {
  external_id: "",
  nome: "",
  manufacturer: "Teltonika",
  model: "",
  imei: "",
  protocol: "teltonika",
  ownership_type: "CUSTOMER",
  caminhao_id: "",
};

/** Menu "⋯" de ações por linha (fecha ao clicar fora ou Esc). */
function RowMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  const visible = items.filter(Boolean);
  if (!visible.length) return null;
  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-slate-100 hover:text-text-primary"
      >
        <span className="text-lg leading-none" aria-hidden>⋯</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-52 animate-pop-in rounded-xl border border-border bg-white p-1 shadow-pop">
          {visible.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                it.onClick();
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${
                it.danger ? "text-red-700 hover:bg-red-50" : "text-text-primary hover:bg-slate-100"
              }`}
            >
              <Icon name={it.icon} className="h-4 w-4 opacity-70" />
              {it.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function TelemetriaDispositivos() {
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = userHasPermission(user, PERMISSIONS.TELEMETRY_WRITE);
  const { data: devices = [], isLoading, error, refetch } = useTelemetryDevicesQuery();
  const { data: caminhoesRes } = useCaminhoesListQuery({ page: 1, limit: 200 }, { enabled: canWrite });
  const trucks = useMemo(() => caminhoesRes?.data || [], [caminhoesRes]);

  const createMut = useCreateTelemetryDeviceMutation();
  const updateMut = useUpdateTelemetryDeviceMutation();
  const assignMut = useAssignTelemetryDeviceMutation();
  const unassignMut = useUnassignTelemetryDeviceMutation();
  const revokeMut = useRevokeTelemetryDeviceMutation();
  const rotateMut = useRotateTelemetryCredentialMutation();

  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [credentialOnce, setCredentialOnce] = useState("");
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignTruck, setAssignTruck] = useState("");
  const [confirm, setConfirm] = useState(null); // { kind: "revoke"|"unassign"|"rotate", device }
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("todos");

  // Veículos que já têm rastreador ativo (para destacar na troca de vínculo).
  const trackedTruckIds = useMemo(
    () => new Set(devices.filter((d) => d.assignment?.caminhao_id).map((d) => Number(d.assignment.caminhao_id))),
    [devices],
  );

  const counts = useMemo(() => {
    const c = { online: 0, offline: 0, awaiting: 0, unassigned: 0 };
    for (const d of devices) {
      if (d.connection_status === "revoked") continue;
      if (c[d.connection_status] != null) c[d.connection_status] += 1;
      if (!d.assignment) c.unassigned += 1;
    }
    return c;
  }, [devices]);

  const filtered = useMemo(() => {
    const order = { offline: 0, awaiting: 1, online: 2, revoked: 3 };
    return devices
      .filter((d) => {
        if (filter === "todos") return true;
        if (filter === "unassigned") return !d.assignment && d.connection_status !== "revoked";
        return d.connection_status === filter;
      })
      .sort((a, b) => (order[a.connection_status] ?? 9) - (order[b.connection_status] ?? 9));
  }, [devices, filter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  };

  const startEdit = (d) => {
    setEditingId(d.id);
    setForm({
      external_id: d.external_id || "",
      nome: d.nome || "",
      manufacturer: d.manufacturer || "",
      model: d.model || "",
      imei: d.imei || "",
      protocol: d.protocol || "http_json",
      ownership_type: d.ownership_type || "CUSTOMER",
      caminhao_id: "",
    });
    setFormError("");
    setFormOpen(true);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setFormError("");
    try {
      if (editingId) {
        await updateMut.mutateAsync({
          id: editingId,
          data: {
            nome: form.nome || null,
            manufacturer: form.manufacturer || null,
            model: form.model || null,
            imei: form.imei || null,
            protocol: form.protocol || null,
            ownership_type: form.ownership_type || null,
          },
        });
        toast.success("Dispositivo atualizado.");
      } else {
        const payload = {
          external_id: form.external_id.trim(),
          nome: form.nome || null,
          manufacturer: form.manufacturer || null,
          model: form.model || null,
          imei: form.imei || null,
          protocol: form.protocol || "http_json",
          ownership_type: form.ownership_type || "CUSTOMER",
        };
        if (form.caminhao_id) payload.caminhao_id = Number(form.caminhao_id);
        const res = await createMut.mutateAsync(payload);
        const credential = res?.data?.credential;
        if (credential) setCredentialOnce(credential);
        toast.success("Dispositivo cadastrado.");
      }
      setFormOpen(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      setFormError((await parseApiError(err)).message);
    }
  };

  const doAssign = async () => {
    if (!assignTarget || !assignTruck) return;
    try {
      await assignMut.mutateAsync({ id: Number(assignTarget.id), caminhao_id: Number(assignTruck) });
      toast.success("Veículo vinculado ao rastreador.");
      setAssignTarget(null);
      setAssignTruck("");
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "revoke") {
        await revokeMut.mutateAsync(confirm.device.id);
        toast.success("Dispositivo revogado.");
      } else if (confirm.kind === "unassign") {
        await unassignMut.mutateAsync(confirm.device.id);
        toast.success("Vínculo encerrado.");
      } else if (confirm.kind === "rotate") {
        const res = await rotateMut.mutateAsync(confirm.device.id);
        const cred = res?.data?.credential;
        if (cred) setCredentialOnce(cred);
        toast.success("Nova credencial gerada.");
      }
      setConfirm(null);
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    } finally {
      setBusy(false);
    }
  };

  const copyCredential = async () => {
    try {
      await navigator.clipboard.writeText(credentialOnce);
      toast.success("Credencial copiada.");
    } catch {
      toast.info("Selecione e copie a credencial manualmente.");
    }
  };

  const queryError = error ? error?.response?.data?.error || error.message || "Falha ao carregar." : "";
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const truckOptions = trucks.map((t) => ({
    value: String(t.id),
    label: `${t.placa}${trackedTruckIds.has(t.id) ? " (já tem rastreador)" : ""}`,
  }));

  const filters = [
    { id: "todos", label: "Todos", n: devices.length },
    { id: "offline", label: "Sem sinal", n: counts.offline },
    { id: "awaiting", label: "Aguardando 1º sinal", n: counts.awaiting },
    { id: "unassigned", label: "Sem veículo", n: counts.unassigned },
  ];

  const confirmCopy = {
    revoke: {
      title: "Revogar dispositivo",
      message: (d) => `Revogar ${d.nome || d.external_id}? Ele para de enviar posições e não pode ser reativado — será preciso cadastrar outro.`,
      confirmText: "Revogar",
      warning: true,
    },
    unassign: {
      title: "Desvincular veículo",
      message: (d) => `Encerrar o vínculo de ${d.nome || d.external_id} com ${d.assignment?.placa}? O histórico até agora é mantido.`,
      confirmText: "Desvincular",
      warning: true,
    },
    rotate: {
      title: "Gerar nova credencial",
      message: (d) => `Gerar nova credencial para ${d.nome || d.external_id}? A credencial atual deixa de funcionar e o aparelho precisa ser reconfigurado (rastreadores Teltonika usam o IMEI e não são afetados).`,
      confirmText: "Gerar credencial",
      warning: false,
    },
  };

  return (
    <PageLayout>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Telemetria"
          title="Dispositivos"
          subtitle="Rastreadores da frota, vínculo com o veículo e situação do sinal."
          actions={
            canWrite ? (
              <Button onClick={openCreate} icon={<Icon name="plus" className="h-4 w-4" strokeWidth={2.25} />}>
                Novo dispositivo
              </Button>
            ) : null
          }
        />

        {queryError && (
          <Alert type="error" title="Não foi possível carregar os dispositivos" message={queryError}>
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          </Alert>
        )}

        {credentialOnce && (
          <Alert type="warning" title="Guarde a credencial agora — ela não será exibida de novo" onClose={() => setCredentialOnce("")}>
            Use no cabeçalho <code className="text-xs">Authorization: Device …</code> (integração HTTP). Rastreadores Teltonika autenticam pelo IMEI.
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-white/70 p-2 text-xs ring-1 ring-amber-200">{credentialOnce}</pre>
              <Button size="sm" variant="outline" onClick={copyCredential}>
                Copiar
              </Button>
            </div>
          </Alert>
        )}

        {devices.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard layout="compact" title="Online" value={counts.online} color="green" icon={<Icon name="signal" />} />
            <StatCard layout="compact" title="Sem sinal" value={counts.offline} color={counts.offline ? "red" : "slate"} hint={counts.offline ? "Verifique alimentação/antena" : "Nenhum"} icon={<Icon name="alert" />} />
            <StatCard layout="compact" title="Aguardando 1º sinal" value={counts.awaiting} color="slate" icon={<Icon name="clock" />} />
            <StatCard layout="compact" title="Sem veículo" value={counts.unassigned} color={counts.unassigned ? "amber" : "slate"} hint="Disponíveis para instalar" icon={<Icon name="device" />} />
          </div>
        ) : null}

        {isLoading ? (
          <TableSkeleton />
        ) : !devices.length ? (
          <EmptyState
            icon={<Icon name="device" className="h-5 w-5" />}
            title="Nenhum dispositivo cadastrado"
            description="Cadastre o rastreador (IMEI) e vincule a um veículo para começar a receber posições."
            action={canWrite ? <Button onClick={openCreate}>Cadastrar dispositivo</Button> : null}
            dashed
          />
        ) : (
          <Card noPadding className="overflow-hidden">
            <div className="scrollbar-thin flex gap-1.5 overflow-x-auto border-b border-border p-3 sm:p-4" role="group" aria-label="Filtrar dispositivos">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`chip shrink-0 ${filter === f.id ? "chip-active" : ""}`}
                >
                  {f.label}
                  <span className="tabular-nums opacity-70">{f.n}</span>
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-secondary">Nenhum dispositivo neste filtro.</p>
            ) : (
              <DataTable fixed={false}>
                <DataTableHead>
                  <tr>
                    <DataTableTh>Dispositivo</DataTableTh>
                    <DataTableTh>Veículo</DataTableTh>
                    <DataTableTh>Situação</DataTableTh>
                    <DataTableTh>Protocolo</DataTableTh>
                    <DataTableTh align="right"><span className="sr-only">Ações</span></DataTableTh>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {filtered.map((d) => {
                    const st = CONNECTION[d.connection_status] || CONNECTION.awaiting;
                    const active = d.ativo && !d.revogado_em;
                    return (
                      <DataTableRow key={d.id} className={active ? "" : "opacity-60"}>
                        <DataTableTd>
                          <p className="font-semibold text-text-primary">{d.nome || d.external_id}</p>
                          <p className="text-xs text-text-secondary">
                            {d.imei ? `IMEI ${d.imei}` : `ID ${d.external_id}`}
                            {[d.manufacturer, d.model].filter(Boolean).length ? ` · ${[d.manufacturer, d.model].filter(Boolean).join(" ")}` : ""}
                          </p>
                        </DataTableTd>
                        <DataTableTd>
                          {d.assignment?.placa ? (
                            <Link to={`/caminhao/${encodeURIComponent(d.assignment.placa)}`} className="plate hover:border-secondary">
                              {d.assignment.placa}
                            </Link>
                          ) : active && canWrite ? (
                            <button
                              type="button"
                              onClick={() => {
                                setAssignTarget(d);
                                setAssignTruck("");
                              }}
                              className="inline-flex items-center gap-1 text-[13px] font-semibold text-secondary-dark hover:text-secondary"
                            >
                              <Icon name="link" className="h-3.5 w-3.5" /> Vincular veículo
                            </button>
                          ) : (
                            <span className="text-text-light">Não vinculado</span>
                          )}
                        </DataTableTd>
                        <DataTableTd>
                          <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${st.text}`}>
                            <span className={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden />
                            {st.label}
                          </span>
                          <span className="block text-xs text-text-secondary">
                            {d.last_seen_at ? `Último sinal ${relativeTime(d.last_seen_at)}` : "Nunca enviou posição"}
                          </span>
                        </DataTableTd>
                        <DataTableTd>
                          <span className="text-sm text-text-primary">{PROTOCOL_LABEL[d.protocol] || d.protocol || "—"}</span>
                          <span className="block text-xs text-text-secondary">{OWNERSHIP_LABEL[d.ownership_type] || ""}</span>
                        </DataTableTd>
                        <DataTableTd align="right">
                          {canWrite && active ? (
                            <RowMenu
                              label={`Ações de ${d.nome || d.external_id}`}
                              items={[
                                { label: "Editar", icon: "pencil", onClick: () => startEdit(d) },
                                { label: d.assignment ? "Trocar veículo" : "Vincular veículo", icon: "link", onClick: () => { setAssignTarget(d); setAssignTruck(""); } },
                                d.assignment ? { label: "Desvincular", icon: "x", onClick: () => setConfirm({ kind: "unassign", device: d }) } : null,
                                { label: "Gerar nova credencial", icon: "refresh", onClick: () => setConfirm({ kind: "rotate", device: d }) },
                                { label: "Revogar", icon: "trash", danger: true, onClick: () => setConfirm({ kind: "revoke", device: d }) },
                              ]}
                            />
                          ) : null}
                        </DataTableTd>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            )}
          </Card>
        )}
      </div>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editingId ? "Editar dispositivo" : "Novo dispositivo"} size="lg">
        <form onSubmit={onSubmit} className="space-y-1">
          {formError ? <Alert type="error" message={formError} className="mb-4" /> : null}
          <div className="grid gap-x-3 sm:grid-cols-2">
            <FormField
              label="Protocolo"
              type="select"
              name="protocol"
              value={form.protocol}
              onChange={setField("protocol")}
              options={[
                { value: "teltonika", label: "Teltonika (TCP)" },
                { value: "http_json", label: "API ATrack (HTTP)" },
              ]}
              helperText={form.protocol === "teltonika" ? "O aparelho se identifica pelo IMEI." : "Uma credencial será gerada para a integração."}
            />
            <FormField
              label="IMEI"
              name="imei"
              value={form.imei}
              onChange={setField("imei")}
              maxLength={32}
              inputMode="numeric"
              helperText={form.protocol === "teltonika" ? "Obrigatório para o aparelho ser reconhecido." : undefined}
            />
            {!editingId && (
              <FormField
                label="Identificador externo"
                name="external_id"
                value={form.external_id}
                onChange={setField("external_id")}
                required
                maxLength={64}
                helperText="Código único do aparelho no seu controle (ex.: nº de série)."
              />
            )}
            <FormField label="Nome" name="nome" value={form.nome} onChange={setField("nome")} maxLength={120} placeholder="Ex.: FMB920 cavalo 12" />
            <FormField label="Fabricante" name="manufacturer" value={form.manufacturer} onChange={setField("manufacturer")} maxLength={64} />
            <FormField label="Modelo" name="model" value={form.model} onChange={setField("model")} maxLength={64} />
            <FormField
              label="Propriedade"
              type="select"
              name="ownership_type"
              value={form.ownership_type}
              onChange={setField("ownership_type")}
              options={[
                { value: "CUSTOMER", label: "Do cliente" },
                { value: "ATRACK", label: "ATrack (comodato)" },
              ]}
            />
            {!editingId && (
              <FormField
                label="Vincular veículo (opcional)"
                type="select"
                name="caminhao_id"
                value={form.caminhao_id}
                onChange={setField("caminhao_id")}
                options={[{ value: "", label: "Vincular depois" }, ...truckOptions]}
              />
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={createMut.isPending || updateMut.isPending}>
              {editingId ? "Salvar alterações" : "Cadastrar dispositivo"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        title={assignTarget?.assignment ? "Trocar veículo" : "Vincular veículo"}
        size="md"
      >
        {assignTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Rastreador <strong className="text-text-primary">{assignTarget.nome || assignTarget.external_id}</strong>
              {assignTarget.assignment?.placa ? (
                <> — hoje em <span className="plate">{assignTarget.assignment.placa}</span>. O vínculo atual será encerrado.</>
              ) : null}
            </p>
            <FormField
              label="Veículo"
              type="searchable"
              name="assign_truck"
              value={assignTruck}
              onChange={(e) => setAssignTruck(e.target.value)}
              options={truckOptions}
              placeholder="Digite a placa…"
            />
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={() => setAssignTarget(null)}>
                Cancelar
              </Button>
              <Button onClick={doAssign} disabled={!assignTruck} loading={assignMut.isPending}>
                Vincular
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        isOpen={Boolean(confirm)}
        onClose={() => !busy && setConfirm(null)}
        onConfirm={runConfirm}
        title={confirm ? confirmCopy[confirm.kind].title : ""}
        message={confirm ? confirmCopy[confirm.kind].message(confirm.device) : ""}
        confirmText={confirm ? confirmCopy[confirm.kind].confirmText : ""}
        cancelText="Cancelar"
        warning={confirm ? confirmCopy[confirm.kind].warning : false}
        loading={busy}
      />
    </PageLayout>
  );
}
