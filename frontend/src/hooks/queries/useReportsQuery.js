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
