import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi.js";
import { useApiMutation } from "./useApiMutation.js";
import { useToast } from "../components/ui/useToast.js";
import { queryKeys } from "../lib/queryKeys.js";
import { extractApiData } from "../utils/extractApiArray.js";

/**
 * Fluxo de exclusão de veículo: verifica dependências
 * (GET /caminhoes/:placa/check-dependencies) e, se liberado, confirma e exclui
 * (DELETE /caminhoes/:placa/cascade). Mesmas regras de antes, agora reutilizável
 * entre o painel e a lista de veículos.
 */
export function useCaminhaoDelete() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { get: apiGet } = useApi();
  const { delete: apiDelete } = useApiMutation();
  const [target, setTarget] = useState(null);
  const [ordensHistoricoCount, setOrdensHistoricoCount] = useState(0);
  const [blockedMessage, setBlockedMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  const requestDelete = async (caminhao) => {
    try {
      const res = await apiGet(`/caminhoes/${caminhao.placa}/check-dependencies`);
      const { temDependencias, detalhes } = extractApiData(res) || {};

      if (temDependencias) {
        const linhas = [];
        if (detalhes?.gastos > 0) linhas.push(`• ${detalhes.gastos} gastos`);
        if (detalhes?.checklists > 0) linhas.push(`• ${detalhes.checklists} manutenções`);
        if (detalhes?.pneus > 0) linhas.push(`• ${detalhes.pneus} pneus`);
        if (detalhes?.documentos > 0) linhas.push(`• ${detalhes.documentos} documentos`);
        setBlockedMessage(
          `Não é possível excluir o caminhão ${caminhao.placa}. Existem registros vinculados:\n${linhas.join("\n")}\n\nRemova esses registros antes de excluir o caminhão.`,
        );
        toast.error("Este caminhão possui registros vinculados e não pode ser excluído.");
        return;
      }

      setTarget(caminhao);
      setOrdensHistoricoCount(detalhes?.ordens_envio ?? 0);
    } catch {
      toast.error("Não foi possível verificar dependências. Tente novamente.");
    }
  };

  const cancel = () => {
    if (deleting) return;
    setTarget(null);
    setOrdensHistoricoCount(0);
  };

  const confirm = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await apiDelete(`/caminhoes/${target.placa}/cascade`, { skipSuccessToast: true });
      toast.success(`Caminhão ${target.placa} excluído com sucesso.`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.caminhoes.all });
      setTarget(null);
      setOrdensHistoricoCount(0);
    } catch (err) {
      const message = err.message?.includes("registros vinculados")
        ? `Não é possível excluir o caminhão ${target.placa}. Existem registros vinculados.`
        : err.message || "Erro ao excluir caminhão. Tente novamente.";
      setBlockedMessage(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const confirmMessage = target
    ? ordensHistoricoCount > 0
      ? `Tem certeza que deseja excluir o caminhão ${target.placa}? ${ordensHistoricoCount} registro(s) de ordem de coleta no histórico também serão removidos. Esta ação não pode ser desfeita.`
      : `Tem certeza que deseja excluir o caminhão ${target.placa}? Esta ação não pode ser desfeita.`
    : "";

  return {
    requestDelete,
    cancel,
    confirm,
    target,
    deleting,
    confirmMessage,
    blockedMessage,
    clearBlocked: () => setBlockedMessage(""),
  };
}
