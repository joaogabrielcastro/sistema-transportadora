import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiData } from "../../utils/extractApiArray.js";

export function useReportsOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.reports.overview,
    queryFn: async () =>
      extractApiData(
        await apiFetch({ method: "GET", url: "/reports/overview" }),
      ),
  });
}

export function useCostPerKmReportQuery(params, enabled = false) {
  return useQuery({
    queryKey: queryKeys.reports.costPerKm(params),
    enabled: enabled && Boolean(params?.startDate && params?.endDate),
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
      });

      if (params.caminhaoId) {
        searchParams.append("caminhaoId", String(params.caminhaoId));
      }

      const res = await apiFetch({
        method: "GET",
        url: `/reports/cost-per-km?${searchParams.toString()}`,
      });

      const payload = extractApiData(res);
      const items = Array.isArray(payload.items) ? payload.items : [];

      return {
        items: items.map((item) => ({
          ...item,
          kmDriven: typeof item.kmDriven === "number" ? item.kmDriven : "N/I",
        })),
        stats: {
          grandTotal: payload.stats?.grandTotal || 0,
          totalKm: payload.stats?.totalKm || 0,
          avgCostPerKm: payload.stats?.avgCostPerKm || 0,
          truckCount: payload.stats?.truckCount || items.length,
        },
      };
    },
  });
}
