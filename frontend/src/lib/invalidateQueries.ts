import { queryClient } from "./queryClient.js";
import { queryKeys } from "./queryKeys.js";

/** Invalida caches do React Query após mutações na API. */
export function invalidateQueriesFromMutation(
  url = "",
  method = "",
): void {
  const path = String(url || "").replace(/^\//, "");
  const m = String(method || "").toLowerCase();

  if (!["post", "put", "patch", "delete"].includes(m)) {
    return;
  }

  if (/^caminhoes/.test(path)) {
    queryClient.invalidateQueries({ queryKey: queryKeys.caminhoes.all });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  }

  if (/^gastos/.test(path)) {
    queryClient.invalidateQueries({ queryKey: queryKeys.gastos.all });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  }

  if (/^checklist/.test(path)) {
    queryClient.invalidateQueries({ queryKey: queryKeys.checklist.all });
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  }

  if (/^ordem-coleta/.test(path)) {
    queryClient.invalidateQueries({ queryKey: queryKeys.ordemColeta.all });
  }

  if (/^itens-checklist/.test(path) || /^tipos-gastos/.test(path)) {
    queryClient.invalidateQueries({ queryKey: queryKeys.manutencaoMeta.all });
  }

  if (
    /^pneus/.test(path) ||
    /^status-pneus/.test(path) ||
    /^posicoes-pneus/.test(path)
  ) {
    queryClient.invalidateQueries({ queryKey: queryKeys.pneus.all });
  }

  // Módulo fiscal de transporte (CT-e / MDF-e)
  if (/^fiscal\/cte\/(emitir|\d+\/cancelar)$/.test(path)) {
    queryClient.invalidateQueries({ queryKey: ["fiscal", "cte", "list"] });
  }
  if (/^fiscal\/mdfe\/(emitir|\d+\/(cancelar|encerrar))$/.test(path)) {
    queryClient.invalidateQueries({ queryKey: ["fiscal", "mdfe", "list"] });
  }
  if (/^fiscal\/clientes/.test(path)) {
    queryClient.invalidateQueries({ queryKey: ["fiscal", "clientes"] });
  }
}
