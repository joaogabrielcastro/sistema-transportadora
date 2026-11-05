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
        // Duração comercial do trial segue a constante do produto (alinhada ao
        // default do backend). Não usar data.trialDays aqui: um BILLING_TRIAL_DAYS
        // antigo no .env de produção ainda devolve 15 e reaparece na landing.
        trialDays: BILLING_TRIAL_DAYS,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
