import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../../src/lib/prisma.js";
import { OrdemColetaService } from "../../src/services/OrdemColetaService.js";

const parsedBase = {
  tipo: "PADRAO",
  placa: null,
  dadosVariaveis: { mercadoria: "Carga teste unitário" },
  emailDestinatario: "destino@test.local",
};

function patchMethods(target, methods, originals) {
  for (const [name, implementation] of Object.entries(methods)) {
    originals.push([target, name, target[name]]);
    target[name] = implementation;
  }
}

function restoreMethods(originals) {
  for (const [target, name, original] of originals) {
    target[name] = original;
  }
}

async function withStubs(stubMap, fn) {
  const originals = [];

  if (stubMap.ordens_coleta_envio) {
    patchMethods(
      prisma.ordens_coleta_envio,
      stubMap.ordens_coleta_envio,
      originals,
    );
  }
  if (stubMap.OrdemColetaService) {
    patchMethods(OrdemColetaService, stubMap.OrdemColetaService, originals);
  }

  try {
    return await fn();
  } finally {
    restoreMethods(originals);
  }
}

function mockEnvioPipeline({ smtpThrows = false } = {}) {
  const updates = [];

  return {
    updates,
    stubs: {
      OrdemColetaService: {
        mergeVars: async () => ({
          mercadoria: "Carga teste unitário",
          placa_cavalo: "",
        }),
        htmlToPdfBuffer: async () => Buffer.from("pdf-mock"),
        enviarEmailComAnexo: smtpThrows
          ? async () => {
              throw new Error("SMTP indisponível");
            }
          : async () => {},
        atualizarRegistroEnvio: async (id, data) => {
          updates.push({ id, data });
        },
      },
    },
  };
}

test("buildHtml inclui dados variáveis no template padrão", () => {
  const html = OrdemColetaService.buildHtml("PADRAO", {
    mercadoria: "Soja em grãos",
    placa_cavalo: "ABC1D23",
  });

  assert.match(html, /Soja em grãos/i);
  assert.match(html, /ABC1D23/);
});

test("processarEnvioPorId ignora envio já concluído", async () => {
  await withStubs(
    {
      ordens_coleta_envio: {
        findUnique: async () => ({
          enviado_em: new Date(),
          erro_envio: null,
          retry_count: 0,
        }),
      },
    },
    async () => {
      const result = await OrdemColetaService.processarEnvioPorId(1, parsedBase);
      assert.equal(result.status, "sent");
      assert.equal(result.skipped, true);
    },
  );
});

test("processarEnvioPorId ignora quando retry_count atingiu o máximo", async () => {
  await withStubs(
    {
      ordens_coleta_envio: {
        findUnique: async () => ({
          enviado_em: null,
          erro_envio: null,
          retry_count: 3,
        }),
      },
    },
    async () => {
      const result = await OrdemColetaService.processarEnvioPorId(99, parsedBase);
      assert.equal(result.status, "failed");
      assert.equal(result.skipped, true);
    },
  );
});

test("processarEnvioPorId envia e marca como sent em sucesso", async () => {
  const pipeline = mockEnvioPipeline();

  await withStubs(
    {
      ordens_coleta_envio: {
        findUnique: async () => ({
          enviado_em: null,
          erro_envio: null,
          retry_count: 0,
        }),
      },
      ...pipeline.stubs,
    },
    async () => {
      const result = await OrdemColetaService.processarEnvioPorId(5, parsedBase);
      assert.equal(result.status, "sent");
      assert.equal(pipeline.updates.length, 1);
      assert.equal(pipeline.updates[0].data.retry_count, 0);
      assert.equal(pipeline.updates[0].data.erro_envio, null);
    },
  );
});

test("processarEnvioPorId incrementa retry sem erro permanente na 1ª falha", async () => {
  const pipeline = mockEnvioPipeline({ smtpThrows: true });

  await withStubs(
    {
      ordens_coleta_envio: {
        findUnique: async () => ({
          enviado_em: null,
          erro_envio: null,
          retry_count: 0,
        }),
      },
      ...pipeline.stubs,
    },
    async () => {
      await assert.rejects(
        () => OrdemColetaService.processarEnvioPorId(7, parsedBase),
        /SMTP indisponível/,
      );
      assert.equal(pipeline.updates.length, 1);
      assert.equal(pipeline.updates[0].data.retry_count, 1);
      assert.equal(pipeline.updates[0].data.erro_envio, null);
    },
  );
});

test("processarEnvioPorId registra erro permanente na 3ª falha", async () => {
  const pipeline = mockEnvioPipeline({ smtpThrows: true });

  await withStubs(
    {
      ordens_coleta_envio: {
        findUnique: async () => ({
          enviado_em: null,
          erro_envio: null,
          retry_count: 2,
        }),
      },
      ...pipeline.stubs,
    },
    async () => {
      await assert.rejects(
        () => OrdemColetaService.processarEnvioPorId(8, parsedBase),
        /SMTP indisponível/,
      );
      assert.equal(pipeline.updates.length, 1);
      assert.equal(pipeline.updates[0].data.retry_count, 3);
      assert.match(
        String(pipeline.updates[0].data.erro_envio),
        /SMTP indisponível/,
      );
    },
  );
});

test("consultarStatusEnvio retorna failed quando há erro_envio", async () => {
  await withStubs(
    {
      ordens_coleta_envio: {
        findFirst: async () => ({
          id: 12,
          assunto: "Ordem teste",
          enviado_em: null,
          erro_envio: "Falha SMTP",
          email_destinatario: "destino@test.local",
          criado_em: new Date(),
        }),
      },
    },
    async () => {
      const status = await OrdemColetaService.consultarStatusEnvio(1, 12);
      assert.equal(status.status, "failed");
      assert.equal(status.error, "Falha SMTP");
    },
  );
});
