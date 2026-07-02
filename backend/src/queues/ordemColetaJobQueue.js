import { logger } from "../utils/logger.js";

const MAX_CONCURRENT = 1;
let active = 0;
const pending = [];
const queuedIds = new Set();

async function drain() {
  if (active >= MAX_CONCURRENT || pending.length === 0) {
    return;
  }

  active += 1;
  const job = pending.shift();
  queuedIds.delete(job.envioId);

  try {
    const { OrdemColetaService } = await import(
      "../services/OrdemColetaService.js"
    );
    await OrdemColetaService.processarEnvioPorId(job.envioId, job.parsed);
  } catch (err) {
    logger.error("Fila ordem coleta: job falhou", {
      envioId: job.envioId,
      err: err?.message,
    });
  } finally {
    active -= 1;
    void drain();
  }
}

/** Enfileira geração de PDF + SMTP (um job por vez para não estourar RAM/Chromium). */
export function enqueueOrdemEnvio(envioId, parsed) {
  const id = Number(envioId);
  if (queuedIds.has(id)) return;
  queuedIds.add(id);
  pending.push({ envioId: id, parsed });
  void drain();
}
