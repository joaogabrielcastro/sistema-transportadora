import React, { useMemo, useState } from "react";
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
  PageHeader,
  StatusBadge,
} from "../../components/ui";
import EmptyState from "../../components/EmptyState.jsx";
import { TableSkeleton } from "../../components/Skeleton.jsx";
import { parseApiError } from "../../lib/apiClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../../utils/permissions.js";
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

const STATUS_LABEL = {
  online: "Online",
  offline: "Offline",
  awaiting: "Aguardando",
  revoked: "Revogado",
};

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

export default function TelemetriaDispositivos() {
  const { user } = useAuth();
  const canWrite = userHasPermission(user, PERMISSIONS.TELEMETRY_WRITE);
  const { data: devices = [], isLoading, error, refetch } =
    useTelemetryDevicesQuery();
  const { data: caminhoesRes } = useCaminhoesListQuery(
    { page: 1, limit: 200 },
    { enabled: canWrite },
  );
  const trucks = caminhoesRes?.data || [];

  const createMut = useCreateTelemetryDeviceMutation();
  const updateMut = useUpdateTelemetryDeviceMutation();
  const assignMut = useAssignTelemetryDeviceMutation();
  const unassignMut = useUnassignTelemetryDeviceMutation();
  const revokeMut = useRevokeTelemetryDeviceMutation();
  const rotateMut = useRotateTelemetryCredentialMutation();

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [credentialOnce, setCredentialOnce] = useState("");
  const [assignId, setAssignId] = useState("");
  const [assignTruck, setAssignTruck] = useState("");

  const truckOptions = useMemo(
    () =>
      trucks.map((t) => ({
        value: String(t.id),
        label: t.placa,
      })),
    [trucks],
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setFormError("");
    setSuccess("");
    setCredentialOnce("");
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
        setSuccess("Dispositivo atualizado.");
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
        if (form.caminhao_id) {
          payload.caminhao_id = Number(form.caminhao_id);
        }
        const res = await createMut.mutateAsync(payload);
        const credential = res?.data?.credential;
        if (credential) {
          setCredentialOnce(credential);
        }
        setSuccess("Dispositivo cadastrado.");
      }
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      const parsed = await parseApiError(err);
      setFormError(parsed.message);
    }
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
    setCredentialOnce("");
    setSuccess("");
    setFormError("");
  };

  const doAssign = async () => {
    if (!assignId || !assignTruck) return;
    setFormError("");
    try {
      await assignMut.mutateAsync({
        id: Number(assignId),
        caminhao_id: Number(assignTruck),
      });
      setSuccess("Veículo vinculado.");
      setAssignId("");
      setAssignTruck("");
    } catch (err) {
      const parsed = await parseApiError(err);
      setFormError(parsed.message);
    }
  };

  const queryError = error
    ? error?.response?.data?.error || error.message || "Falha ao carregar."
    : "";

  return (
    <PageLayout>
      <div className="space-y-6">
        <PageHeader
          title="Dispositivos"
          subtitle="Cadastre rastreadores ATrack ou do cliente e vincule a um veículo."
        />

        {(formError || queryError) && (
          <Alert type="error">{formError || queryError}</Alert>
        )}
        {success && <Alert type="success">{success}</Alert>}
        {credentialOnce && (
          <Alert type="warning" title="Guarde a credencial agora">
            Ela não será exibida novamente. Use no header{" "}
            <code className="text-xs">Authorization: Device …</code> (HTTP) ou
            configure o IMEI no aparelho Teltonika.
            <pre className="mt-2 overflow-x-auto rounded bg-black/5 p-2 text-xs">
              {credentialOnce}
            </pre>
          </Alert>
        )}

        {canWrite && (
          <Card
            title={editingId ? "Editar dispositivo" : "Novo dispositivo"}
            subtitle="Para Teltonika, informe o IMEI e protocolo teltonika."
          >
            <form
              onSubmit={onSubmit}
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              {!editingId && (
                <FormField
                  label="Identificador externo"
                  name="external_id"
                  value={form.external_id}
                  onChange={(e) =>
                    setForm({ ...form, external_id: e.target.value })
                  }
                  required
                  maxLength={64}
                />
              )}
              <FormField
                label="Nome"
                name="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                maxLength={120}
              />
              <FormField
                label="Fabricante"
                name="manufacturer"
                value={form.manufacturer}
                onChange={(e) =>
                  setForm({ ...form, manufacturer: e.target.value })
                }
                maxLength={64}
              />
              <FormField
                label="Modelo"
                name="model"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                maxLength={64}
              />
              <FormField
                label="IMEI"
                name="imei"
                value={form.imei}
                onChange={(e) => setForm({ ...form, imei: e.target.value })}
                maxLength={32}
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-text-secondary">Protocolo</span>
                <select
                  className="rounded-lg border border-border bg-white px-3 py-2"
                  value={form.protocol}
                  onChange={(e) =>
                    setForm({ ...form, protocol: e.target.value })
                  }
                >
                  <option value="teltonika">teltonika</option>
                  <option value="http_json">http_json</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-text-secondary">
                  Propriedade
                </span>
                <select
                  className="rounded-lg border border-border bg-white px-3 py-2"
                  value={form.ownership_type}
                  onChange={(e) =>
                    setForm({ ...form, ownership_type: e.target.value })
                  }
                >
                  <option value="CUSTOMER">Cliente</option>
                  <option value="ATRACK">ATrack</option>
                </select>
              </label>
              {!editingId && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-text-secondary">
                    Vincular veículo (opcional)
                  </span>
                  <select
                    className="rounded-lg border border-border bg-white px-3 py-2"
                    value={form.caminhao_id}
                    onChange={(e) =>
                      setForm({ ...form, caminhao_id: e.target.value })
                    }
                  >
                    <option value="">—</option>
                    {truckOptions.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex items-end gap-2 md:col-span-2 xl:col-span-3">
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {editingId ? "Salvar" : "Cadastrar"}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </Card>
        )}

        {canWrite && devices.length > 0 && (
          <Card title="Vincular veículo" subtitle="Troca o vínculo ativo do dispositivo.">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-[10rem] flex-col gap-1 text-sm">
                <span className="font-medium text-text-secondary">Dispositivo</span>
                <select
                  className="rounded-lg border border-border bg-white px-3 py-2"
                  value={assignId}
                  onChange={(e) => setAssignId(e.target.value)}
                >
                  <option value="">—</option>
                  {devices
                    .filter((d) => d.ativo && !d.revogado_em)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome || d.external_id}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex min-w-[10rem] flex-col gap-1 text-sm">
                <span className="font-medium text-text-secondary">Veículo</span>
                <select
                  className="rounded-lg border border-border bg-white px-3 py-2"
                  value={assignTruck}
                  onChange={(e) => setAssignTruck(e.target.value)}
                >
                  <option value="">—</option>
                  {truckOptions.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                onClick={doAssign}
                disabled={assignMut.isPending || !assignId || !assignTruck}
              >
                Vincular
              </Button>
            </div>
          </Card>
        )}

        {isLoading ? (
          <TableSkeleton />
        ) : !devices.length ? (
          <EmptyState
            title="Nenhum dispositivo"
            description="Cadastre um rastreador para começar a receber posições."
            dashed
          />
        ) : (
          <Card title="Lista" subtitle={`${devices.length} dispositivo(s)`}>
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableTh>Nome / ID</DataTableTh>
                  <DataTableTh>IMEI</DataTableTh>
                  <DataTableTh>Protocolo</DataTableTh>
                  <DataTableTh>Veículo</DataTableTh>
                  <DataTableTh>Status</DataTableTh>
                  <DataTableTh>Ações</DataTableTh>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {devices.map((d) => (
                  <DataTableRow key={d.id}>
                    <DataTableTd>
                      <div className="font-medium">{d.nome || "—"}</div>
                      <div className="text-xs text-text-secondary">
                        {d.external_id}
                      </div>
                    </DataTableTd>
                    <DataTableTd>{d.imei || "—"}</DataTableTd>
                    <DataTableTd>{d.protocol || "—"}</DataTableTd>
                    <DataTableTd>
                      {d.assignment?.placa || "—"}
                    </DataTableTd>
                    <DataTableTd>
                      <StatusBadge
                        status={
                          STATUS_LABEL[d.connection_status] ||
                          d.connection_status ||
                          "—"
                        }
                      />
                    </DataTableTd>
                    <DataTableTd>
                      {canWrite ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(d)}
                          >
                            Editar
                          </Button>
                          {d.assignment && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await unassignMut.mutateAsync(d.id);
                                  setSuccess("Vínculo encerrado.");
                                } catch (err) {
                                  setFormError((await parseApiError(err)).message);
                                }
                              }}
                            >
                              Desvincular
                            </Button>
                          )}
                          {d.ativo && !d.revogado_em && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  const res = await rotateMut.mutateAsync(d.id);
                                  const cred = res?.data?.credential;
                                  if (cred) setCredentialOnce(cred);
                                  setSuccess("Credencial rotacionada.");
                                } catch (err) {
                                  setFormError((await parseApiError(err)).message);
                                }
                              }}
                            >
                              Rotacionar
                            </Button>
                          )}
                          {d.ativo && !d.revogado_em && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={async () => {
                                if (!window.confirm("Revogar este dispositivo?")) {
                                  return;
                                }
                                try {
                                  await revokeMut.mutateAsync(d.id);
                                  setSuccess("Dispositivo revogado.");
                                } catch (err) {
                                  setFormError((await parseApiError(err)).message);
                                }
                              }}
                            >
                              Revogar
                            </Button>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Atualizar
              </Button>
            </div>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}
