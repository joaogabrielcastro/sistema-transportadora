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
} from "../../components/ui";
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
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    lat: "-25.4284",
    lng: "-49.2733",
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

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await createMut.mutateAsync({
        name: form.name,
        shape: "circle",
        geometry: {
          center: { lat: Number(form.lat), lng: Number(form.lng) },
          radius_m: Number(form.radius_m),
        },
        caminhao_ids: form.caminhao_id ? [Number(form.caminhao_id)] : [],
      });
      setForm({ ...form, name: "" });
    } catch (err) {
      setError((await parseApiError(err)).message);
    }
  };

  return (
    <PageLayout>
      <div className="space-y-6">
        <PageHeader
          title="Geocercas"
          subtitle="Áreas no mapa para avisar entrada e saída do veículo."
        />
        {error && <Alert type="error">{error}</Alert>}

        {canWrite && (
          <Card title="Nova geocerca circular">
            <form
              onSubmit={onSubmit}
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              <FormField
                label="Nome"
                name="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <FormField
                label="Latitude"
                name="lat"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                required
              />
              <FormField
                label="Longitude"
                name="lng"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                required
              />
              <FormField
                label="Raio (m)"
                name="radius_m"
                value={form.radius_m}
                onChange={(e) => setForm({ ...form, radius_m: e.target.value })}
                required
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-text-secondary">
                  Veículo (opcional)
                </span>
                <select
                  className="rounded-lg border border-border bg-white px-3 py-2"
                  value={form.caminhao_id}
                  onChange={(e) =>
                    setForm({ ...form, caminhao_id: e.target.value })
                  }
                >
                  <option value="">Todos da frota</option>
                  {trucks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.placa}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <Button type="submit" disabled={createMut.isPending}>
                  Cadastrar
                </Button>
              </div>
            </form>
          </Card>
        )}

        {isLoading ? (
          <TableSkeleton />
        ) : !fences.length ? (
          <EmptyState
            title="Nenhuma geocerca"
            description="Cadastre uma região para gerar alertas de entrada/saída."
            dashed
          />
        ) : (
          <Card title="Cadastradas">
            <DataTable>
              <DataTableHead>
                <DataTableRow>
                  <DataTableTh>Nome</DataTableTh>
                  <DataTableTh>Forma</DataTableTh>
                  <DataTableTh>Detalhe</DataTableTh>
                  <DataTableTh>Veículos</DataTableTh>
                  <DataTableTh></DataTableTh>
                </DataTableRow>
              </DataTableHead>
              <DataTableBody>
                {fences.map((g) => (
                  <DataTableRow key={g.id}>
                    <DataTableTd>{g.name}</DataTableTd>
                    <DataTableTd>{g.shape}</DataTableTd>
                    <DataTableTd>
                      {g.shape === "circle"
                        ? `${g.geometry?.radius_m} m · ${g.geometry?.center?.lat}, ${g.geometry?.center?.lng}`
                        : `${g.geometry?.points?.length || 0} pontos`}
                    </DataTableTd>
                    <DataTableTd>
                      {g.vehicles?.length
                        ? g.vehicles.map((v) => v.placa).join(", ")
                        : "Todos"}
                    </DataTableTd>
                    <DataTableTd>
                      {canWrite ? (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            if (window.confirm("Excluir geocerca?")) {
                              deleteMut.mutate(g.id);
                            }
                          }}
                        >
                          Excluir
                        </Button>
                      ) : null}
                    </DataTableTd>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}
