import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiArray, extractApiData } from "../../utils/extractApiArray.js";

export function useTelemetryDevicesQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.telemetry.devices(params),
    enabled: options.enabled !== false,
    queryFn: async () =>
      extractApiArray(
        await apiFetch({
          method: "GET",
          url: "/telemetry/devices",
          params,
        }),
      ),
  });
}

export function useTelemetryCurrentQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.telemetry.current(params),
    enabled: options.enabled !== false,
    refetchInterval: options.refetchInterval ?? false,
    queryFn: async () =>
      extractApiArray(
        await apiFetch({
          method: "GET",
          url: "/telemetry/current",
          params,
        }),
      ),
  });
}

export function useTelemetryHistoryQuery(params, options = {}) {
  return useQuery({
    queryKey: queryKeys.telemetry.history(params || {}),
    enabled: Boolean(params?.caminhao_id) && options.enabled !== false,
    refetchInterval: options.refetchInterval ?? false,
    queryFn: async () =>
      extractApiData(
        await apiFetch({
          method: "GET",
          url: "/telemetry/history",
          params,
        }),
      ),
  });
}

export function useTelemetryGeofencesQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.telemetry.geofences(),
    enabled: options.enabled !== false,
    queryFn: async () =>
      extractApiArray(await apiFetch({ method: "GET", url: "/telemetry/geofences" })),
  });
}

export function useTelemetryAlertsQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.telemetry.alerts(params),
    enabled: options.enabled !== false,
    refetchInterval: options.refetchInterval ?? false,
    queryFn: async () =>
      extractApiArray(
        await apiFetch({
          method: "GET",
          url: "/telemetry/alerts",
          params,
        }),
      ),
  });
}

export function useTelemetryEfficiencyQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.telemetry.efficiency(params),
    enabled: options.enabled !== false,
    queryFn: async () =>
      extractApiData(
        await apiFetch({
          method: "GET",
          url: "/telemetry/reports/efficiency",
          params,
        }),
      ),
  });
}

/** Eventos de condução (frenagem/aceleração/curva bruscas, excesso de velocidade…). */
export function useTelemetryDrivingQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.telemetry.driving(params),
    enabled: options.enabled !== false,
    queryFn: async () =>
      extractApiData(
        await apiFetch({
          method: "GET",
          url: "/telemetry/reports/driving",
          params,
        }),
      ),
  });
}

function invalidateTelemetry(qc) {
  return qc.invalidateQueries({ queryKey: queryKeys.telemetry.all });
}

export function useCreateTelemetryDeviceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) =>
      apiFetch({ method: "POST", url: "/telemetry/devices", data }),
    onSuccess: () => invalidateTelemetry(qc),
  });
}

export function useUpdateTelemetryDeviceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) =>
      apiFetch({ method: "PATCH", url: `/telemetry/devices/${id}`, data }),
    onSuccess: () => invalidateTelemetry(qc),
  });
}

export function useAssignTelemetryDeviceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, caminhao_id }) =>
      apiFetch({
        method: "POST",
        url: `/telemetry/devices/${id}/assign`,
        data: { caminhao_id },
      }),
    onSuccess: () => invalidateTelemetry(qc),
  });
}

export function useUnassignTelemetryDeviceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch({ method: "POST", url: `/telemetry/devices/${id}/unassign` }),
    onSuccess: () => invalidateTelemetry(qc),
  });
}

export function useRevokeTelemetryDeviceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch({ method: "POST", url: `/telemetry/devices/${id}/revoke` }),
    onSuccess: () => invalidateTelemetry(qc),
  });
}

export function useRotateTelemetryCredentialMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiFetch({
        method: "POST",
        url: `/telemetry/devices/${id}/rotate-credential`,
        data: {},
      }),
    onSuccess: () => invalidateTelemetry(qc),
  });
}
