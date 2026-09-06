import { logger } from "../../utils/logger.js";

/**
 * Pontos de integração com CT-e/MDF-e. Intencionalmente finos: a emissão
 * SEFAZ não espera a averbadora. Falha de agendamento nunca derruba o CT-e.
 */
export function agendarAverbacaoAposAutorizacao({ tenantId, tipo, documentoId }) {
  void (async () => {
    try {
      const { AverbacaoService } = await import("./AverbacaoService.js");
      await AverbacaoService.agendarAposAutorizacao({
        tenantId,
        tipo,
        documentoId,
      });
    } catch (err) {
      logger.error("Falha ao agendar averbação após autorização", {
        tenantId,
        tipo,
        documentoId,
        message: err?.message,
      });
    }
  })();
}

export function agendarCancelamentoAverbacao({ tenantId, tipo, documentoId }) {
  void (async () => {
    try {
      const { AverbacaoService } = await import("./AverbacaoService.js");
      await AverbacaoService.agendarCancelamento({
        tenantId,
        tipo,
        documentoId,
      });
    } catch (err) {
      logger.error("Falha ao agendar cancelamento de averbação", {
        tenantId,
        tipo,
        documentoId,
        message: err?.message,
      });
    }
  })();
}

export async function anexarAverbacaoAoDocumento(tenantId, { cteId, mdfeId } = {}) {
  try {
    const { AverbacaoService } = await import("./AverbacaoService.js");
    return await AverbacaoService.buscarPorDocumento(tenantId, { cteId, mdfeId });
  } catch (err) {
    logger.warn("Falha ao anexar averbação ao documento", {
      tenantId,
      cteId,
      mdfeId,
      message: err?.message,
    });
    return null;
  }
}
