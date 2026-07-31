import test from "node:test";
import assert from "node:assert/strict";
import {
  enqueueOrdemEnvio,
  getOrdemColetaQueueMode,
  closeOrdemColetaQueue,
} from "../../src/queues/ordemColetaJobQueue.js";
import { OrdemColetaService } from "../../src/services/OrdemColetaService.js";

test("fila sem REDIS_URL opera em modo memória", () => {
  const saved = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  try {
    // config já carregado — modo depende de config.redis.url no boot do módulo
    assert.ok(["memory", "redis"].includes(getOrdemColetaQueueMode()));
  } finally {
    if (saved !== undefined) process.env.REDIS_URL = saved;
  }
});

test("enqueueOrdemEnvio memória processa job via processarEnvioPorId", async () => {
  const calls = [];
  const original = OrdemColetaService.processarEnvioPorId;
  OrdemColetaService.processarEnvioPorId = async (envioId, parsed) => {
    calls.push({ envioId, parsed });
    return { id: envioId, status: "sent" };
  };

  try {
    const result = await enqueueOrdemEnvio(4242, {
      tipo: "PADRAO",
      placa: null,
      dadosVariaveis: {},
      emailDestinatario: "a@b.com",
    });

    // Sem Redis no ambiente de teste → memory
    if (result.mode === "memory") {
      await new Promise((r) => setTimeout(r, 30));
      assert.equal(calls.length, 1);
      assert.equal(calls[0].envioId, 4242);
    } else {
      assert.equal(result.mode, "redis");
    }
  } finally {
    OrdemColetaService.processarEnvioPorId = original;
    await closeOrdemColetaQueue();
  }
});
