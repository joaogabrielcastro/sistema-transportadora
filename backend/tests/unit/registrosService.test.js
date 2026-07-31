import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../../src/lib/prisma.js";
import { RegistrosService } from "../../src/services/RegistrosService.js";

function patchPrisma(stubs) {
  const originals = [];
  for (const [model, methods] of Object.entries(stubs)) {
    for (const [name, impl] of Object.entries(methods)) {
      originals.push([prisma[model], name, prisma[model][name]]);
      prisma[model][name] = impl;
    }
  }
  return () => {
    for (const [target, name, original] of originals) {
      target[name] = original;
    }
  };
}

test("RegistrosService.list mescla gastos e manutenções ordenados e pagina", async () => {
  const restore = patchPrisma({
    gastos: {
      count: async () => 2,
      findMany: async () => [
        {
          id: 1,
          data_gasto: "2026-07-10",
          descricao: "Diesel",
          tipos_gastos: { nome_tipo: "Combustível" },
          caminhoes: { placa: "ABC1D23" },
        },
        {
          id: 2,
          data_gasto: "2026-07-01",
          descricao: "Pedágio",
          tipos_gastos: { nome_tipo: "Pedágio" },
          caminhoes: { placa: "ABC1D23" },
        },
      ],
    },
    checklist: {
      count: async () => 1,
      findMany: async () => [
        {
          id: 10,
          data_manutencao: "2026-07-15",
          observacao: "Troca óleo",
          itens_checklist: { nome_item: "Óleo" },
          caminhoes: { placa: "ABC1D23" },
        },
      ],
    },
  });

  try {
    const result = await RegistrosService.list(1, { page: 1, limit: 2 });
    assert.equal(result.pagination.totalItems, 3);
    assert.equal(result.data.length, 2);
    assert.equal(result.data[0].tipo_registro, "Manutenção");
    assert.equal(result.data[1].tipo_registro, "Gasto");
    assert.equal(result.data[1].nome_tipo, "Combustível");
  } finally {
    restore();
  }
});

test("RegistrosService.list empurra datas futuras para o fim do histórico", async () => {
  const restore = patchPrisma({
    gastos: {
      count: async () => 0,
      findMany: async () => [],
    },
    checklist: {
      count: async () => 2,
      findMany: async () => [
        {
          id: 99,
          data_manutencao: "2099-12-16",
          observacao: "Import OCR futuro",
          itens_checklist: { nome_item: "Lubrificação" },
          caminhoes: { placa: "RHN9C65" },
        },
        {
          id: 100,
          data_manutencao: "2026-07-30",
          observacao: "Recente",
          itens_checklist: { nome_item: "Alternador" },
          caminhoes: { placa: "AUO5259" },
        },
      ],
    },
  });

  try {
    const result = await RegistrosService.list(1, { page: 1, limit: 10 });
    assert.equal(result.data.length, 2);
    assert.equal(result.data[0].nome_tipo, "Alternador");
    assert.equal(result.data[1].nome_tipo, "Lubrificação");
  } finally {
    restore();
  }
});

test("RegistrosService.list filtra por caminhaoId no where", async () => {
  let capturedWhere;
  const restore = patchPrisma({
    gastos: {
      count: async ({ where }) => {
        capturedWhere = where;
        return 0;
      },
      findMany: async () => [],
    },
    checklist: {
      count: async () => 0,
      findMany: async () => [],
    },
  });

  try {
    await RegistrosService.list(5, { caminhaoId: 12 });
    assert.equal(capturedWhere.tenant_id, 5);
    assert.equal(capturedWhere.caminhao_id, 12);
  } finally {
    restore();
  }
});

test("RegistrosService.list filtra por placa contains", async () => {
  let capturedWhere;
  const restore = patchPrisma({
    gastos: {
      count: async ({ where }) => {
        capturedWhere = where;
        return 0;
      },
      findMany: async () => [],
    },
    checklist: {
      count: async () => 0,
      findMany: async () => [],
    },
  });

  try {
    await RegistrosService.list(1, { placa: "abc-1d23" });
    assert.equal(capturedWhere.tenant_id, 1);
    assert.equal(capturedWhere.caminhoes.placa.contains, "ABC1D23");
  } finally {
    restore();
  }
});
