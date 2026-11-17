import React, { useState } from "react";
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
  TableRowActions,
} from "../../components/ui";
import Icon from "../../components/ui/Icon.jsx";
import ConfirmModal from "../../components/ConfirmModal.jsx";
import GeofencePickerMap from "../../components/telemetria/GeofencePickerMap.jsx";
import { useToast } from "../../components/ui/useToast.js";
import EmptyState from "../../components/EmptyState.jsx";
import { TableSkeleton } from "../../components/Skeleton.jsx";
import { apiFetch, parseApiError } from "../../lib/apiClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { PERMISSIONS, userHasPermission } from "../../utils/permissions.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray } from "../../utils/extractApiArray.js";
import { useCaminhoesListQuery } from "../../hooks/queries/useCaminhoesQuery.js";

export default function TelemetriaGeocercas() {
  const { user } = useAuth();
  const canWrite = userHasPermission(user, PERMISSIONS.TELEMETRY_WRITE);
  const qc = useQueryClient();
  const toast = useToast();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    lat: "",
    lng: "",
    radius_m: "1000",
    caminhao_id: "",
  });

  const { data: fences = [], isLoading } = useQuery({
    queryKey: [...queryKeys.telemetry.all, "geofences"],
    queryFn: async () =>
      extractApiArray(await apiFetch({ url: "/telemetry/geofences" })),
  });

  const { data: caminhoesRes } = useCaminhoesListQuery(
    { page: 1, limit: 200 },
    { enabled: canWrite },
  );
  const trucks = caminhoesRes?.data || [];

  const createMut = useMutation({
    mutationFn: (body) =>
      apiFetch({ method: "POST", url: "/telemetry/geofences", data: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.telemetry.all }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) =>
      apiFetch({ method: "DELETE", url: `/telemetry/geofences/${id}` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.telemetry.all }),
  });

  const [focus, setFocus] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const center =
    form.lat !== "" && form.lng !== "" && Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng))
      ? { lat: Number(form.lat), lng: Number(form.lng) }
      : null;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!center) {
      setError("Clique no mapa para posicionar o centro da geocerca.");
      return;
    }
    try {
      await createMut.mutateAsync({
        name: form.name,
        shape: "circle",
        geometry: {
          center,
          radius_m: Number(form.radius_m),
        },
        caminhao_ids: form.caminhao_id ? [Number(form.caminhao_id)] : [],
      });
      toast.success(`Geocerca “${form.name}” criada.`);
      setForm({ ...form, name: "" });
    } catch (err) {
      setError((await parseApiError(err)).message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      toast.success("Geocerca excluída.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error((await parseApiError(err)).message);
    }
  };

  const RADIUS_PRESETS = [300, 500, 1000, 2000, 5000];

  return (
    <PageLayout>
      <div className="space-y-5">
        <PageHeader
          eyebrow="Telemetria"
          title="Geocercas"
          subtitle="Áreas como pátio, clientes e postos para acompanhar entrada e saída dos veículos."
        />
        {error && <Alert type="error" message={error} onClose={() => setError("")} />}

        {canWrite && (
          <Card noPadding className="overflow-hidden" title="Nova geocerca" subtitle="Clique no mapa para posicionar o centro e ajuste o raio.">
            <div className="grid lg:grid-cols-[1fr_340px]">
              <div className="relative h-[320px] border-b border-border lg:h-[420px] lg:border-b-0 lg:border-r">
                <GeofencePickerMap
                  center={center}
                  radiusM={Number(form.radius_m) || 0}
                  existing={fences}
                  focus={focus}
                  onPick={({ lat, lng }) => setForm((f) => ({ ...f, lat: String(lat), lng: String(lng) }))}
                />
                {!center ? (
                  <div className="pointer-events-none absolute left-1/2 top-3 z-[400] -translate-x-1/2 rounded-full bg-primary/90 px-3 py-1.5 text-xs font-semibold text-white shadow">
                    Clique no mapa para marcar o centro
                  </div>
                ) : null}
              </div>
              <form onSubmit={onSubmit} className="space-y-1 p-4 sm:p-5">
                <FormField
                  label="Nome"
                  name="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Ex.: Pátio Curitiba, Cliente Porto"
                />
                <div className="mb-4">
                  <FormField
                    label="Raio (m)"
                    name="radius_m"
                    type="number"
                    value={form.radius_m}
                    onChange={(e) => setForm({ ...form, radius_m: e.target.value })}
                    required
                    className="mb-2"
                  />
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Raios comuns">
                    {RADIUS_PRESETS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm({ ...form, radius_m: String(r) })}
                        className={`chip !min-h-7 !px-2.5 text-xs ${Number(form.radius_m) === r ? "chip-active" : ""}`}
                      >
                        {r >= 1000 ? `${r / 1000} km` : `${r} m`}
                      </button>
                    ))}
                  </div>
                </div>
                <FormField
                  label="Aplicar a"
                  type="select"
                  name="caminhao_id"
                  value={form.caminhao_id}
                  onChange={(e) => setForm({ ...form, caminhao_id: e.target.value })}
                  options={[{ value: "", label: "Todos os veículos" }, ...trucks.map((t) => ({ value: String(t.id), label: t.placa }))]}
                />
                <details className="mb-4 text-xs text-text-secondary">
                  <summary className="cursor-pointer select-none">Informar coordenadas manualmente</summary>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <FormField label="Latitude" name="lat" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className="mb-0" />
                    <FormField label="Longitude" name="lng" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className="mb-0" />
                  </div>
                </details>
                <Button type="submit" className="w-full" loading={createMut.isPending} disabled={!center}>
                  Criar geocerca
                </Button>
              </form>
            </div>
          </Card>
        )}

        <Card noPadding className="overflow-hidden" title="Geocercas cadastradas" subtitle={`${fences.length} área(s)`}>
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={3} columns={4} />
            </div>
          ) : !fences.length ? (
            <div className="p-4">
              <EmptyState compact icon={<Icon name="map" className="h-5 w-5" />} title="Nenhuma geocerca" description="Crie a primeira marcando o pátio da empresa no mapa." />
            </div>
          ) : (
            <DataTable fixed={false}>
              <DataTableHead>
                <tr>
                  <DataTableTh>Nome</DataTableTh>
                  <DataTableTh>Área</DataTableTh>
                  <DataTableTh>Veículos</DataTableTh>
                  <DataTableTh align="right"><span className="sr-only">Ações</span></DataTableTh>
                </tr>
              </DataTableHead>
              <DataTableBody>
                {fences.map((g) => (
                  <DataTableRow key={g.id}>
                    <DataTableTd>
                      <p className="font-semibold text-text-primary">{g.name}</p>
                      {g.enabled === false ? <p className="text-xs text-text-light">Desativada</p> : null}
                    </DataTableTd>
                    <DataTableTd>
                      {g.shape === "circle" && g.geometry?.center ? (
                        <button
                          type="button"
                          onClick={() => setFocus({ ...g.geometry.center, _t: Date.now() })}
                          className="text-left text-sm text-secondary-dark hover:underline"
                          title="Ver no mapa"
                        >
                          Raio de {Number(g.geometry.radius_m).toLocaleString("pt-BR")} m
                        </button>
                      ) : (
                        <span className="text-sm">{g.shape === "polygon" ? "Polígono" : g.shape}</span>
                      )}
                    </DataTableTd>
                    <DataTableTd>
                      {g.vehicles?.length ? (
                        <span className="flex flex-wrap gap-1">
                          {g.vehicles.map((v) => (
                            <span key={v.placa} className="plate !text-[11px]">{v.placa}</span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-text-secondary">Todos</span>
                      )}
                    </DataTableTd>
                    <DataTableTd align="right">
                      {canWrite ? (
                        <TableRowActions onDelete={() => setDeleteTarget(g)} deleteTitle={`Excluir ${g.name}`} />
                      ) : null}
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          )}
        </Card>
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleteMut.isPending && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Excluir geocerca"
        message={deleteTarget ? `Excluir a geocerca “${deleteTarget.name}”? Esta ação não pode ser desfeita.` : ""}
        confirmText="Excluir"
        cancelText="Cancelar"
        warning
        loading={deleteMut.isPending}
      />
    </PageLayout>
  );
}
