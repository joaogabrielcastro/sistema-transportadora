import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/apiClient.js";
import { queryKeys } from "../../lib/queryKeys.js";
import { extractApiData } from "../../utils/extractApiArray.js";
import { BILLING_TRIAL_DAYS, resolvePlanCards } from "../../utils/billing.js";

export function usePublicPlansQuery() {
  return useQuery({
    queryKey: queryKeys.billing.plans,
    queryFn: async () => {
      const res = await apiFetch({ url: "/billing/plans" });
      const data = extractApiData(res) ?? res.data ?? res;
      const plans = resolvePlanCards(data?.plans);
      return {
        plans,
        trialDays: Number(data?.trialDays) || BILLING_TRIAL_DAYS,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
