import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../../src/lib/prisma.js";
import {
  resolveCombustivelTipoId,
  clearCombustivelTipoCache,
} from "../../src/utils/tiposGastos.js";

test("resolveCombustivelTipoId encontra combustível com acento e usa cache", async () => {
  clearCombustivelTipoCache();
  const original = prisma.tipos_gastos.findMany;
  let calls = 0;

  prisma.tipos_gastos.findMany = async () => {
    calls += 1;
    return [
      { id: 1, nome_tipo: "Pedágio" },
      { id: 9, nome_tipo: "Combustível" },
    ];
  };

  try {
    assert.equal(await resolveCombustivelTipoId(), 9);
    assert.equal(await resolveCombustivelTipoId(), 9);
    assert.equal(calls, 1);
  } finally {
    prisma.tipos_gastos.findMany = original;
    clearCombustivelTipoCache();
  }
});

test("resolveCombustivelTipoId retorna null quando não encontra", async () => {
  clearCombustivelTipoCache();
  const original = prisma.tipos_gastos.findMany;
  prisma.tipos_gastos.findMany = async () => [{ id: 1, nome_tipo: "Pedágio" }];

  try {
    assert.equal(await resolveCombustivelTipoId(), null);
  } finally {
    prisma.tipos_gastos.findMany = original;
    clearCombustivelTipoCache();
  }
});
