import prisma from "../lib/prisma.js";
import {
  DEFAULT_TIPOS_GASTOS,
  normalizeTipoGastoName,
  selectCanonicalTipo,
} from "./tiposGastosCatalog.js";

const COMBUSTIVEL_NAMES = ["combustível", "combustivel", "combust"];

let cachedCombustivelId = null;

export async function resolveCombustivelTipoId() {
  if (cachedCombustivelId != null) return cachedCombustivelId;

  const tipos = await prisma.tipos_gastos.findMany({
    select: { id: true, nome_tipo: true },
  });

  const found = tipos.find((t) => {
    const n = normalizeTipoGastoName(t.nome_tipo);
    return COMBUSTIVEL_NAMES.some((key) => n.includes(key.replace(/í/g, "i")));
  });

  cachedCombustivelId = found?.id ?? null;
  return cachedCombustivelId;
}

export function clearCombustivelTipoCache() {
  cachedCombustivelId = null;
}

async function mergeDuplicateTiposGastos() {
  const tipos = await prisma.tipos_gastos.findMany({
    select: { id: true, nome_tipo: true },
    orderBy: { id: "asc" },
  });
  const groups = new Map();
  for (const t of tipos) {
    const key = normalizeTipoGastoName(t.nome_tipo);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const keeper = selectCanonicalTipo(list);
    if (!keeper) continue;
    const extras = list.filter((t) => t.id !== keeper.id);
    for (const extra of extras) {
      await prisma.gastos.updateMany({
        where: { tipo_gasto_id: extra.id },
        data: { tipo_gasto_id: keeper.id },
      });
      await prisma.tipos_gastos.delete({ where: { id: extra.id } });
      removed += 1;
    }
    const catalogName = DEFAULT_TIPOS_GASTOS.find(
      (nome) => normalizeTipoGastoName(nome) === normalizeTipoGastoName(keeper.nome_tipo),
    );
    if (catalogName && keeper.nome_tipo !== catalogName) {
      await prisma.tipos_gastos.update({
        where: { id: keeper.id },
        data: { nome_tipo: catalogName },
      });
    }
  }
  if (removed > 0) clearCombustivelTipoCache();
  return removed;
}

/**
 * Garante tipos de gasto padrão (idempotente).
 * Respeita "Combustivel" legado sem acento — não duplica combustível.
 */
export async function ensureDefaultTiposGastos() {
  await mergeDuplicateTiposGastos();
  const existing = await prisma.tipos_gastos.findMany({
    select: { nome_tipo: true },
  });
  const existingNorm = new Set(
    existing.map((t) => normalizeTipoGastoName(t.nome_tipo)),
  );

  const hasCombustivel = [...existingNorm].some((n) =>
    COMBUSTIVEL_NAMES.some((key) =>
      n.includes(key.normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
    ),
  );

  let created = 0;

  for (const nome_tipo of DEFAULT_TIPOS_GASTOS) {
    const norm = normalizeTipoGastoName(nome_tipo);
    if (norm === "combustivel" && hasCombustivel) continue;
    if (existingNorm.has(norm)) continue;

    await prisma.tipos_gastos.create({ data: { nome_tipo } });
    existingNorm.add(norm);
    created += 1;
  }

  if (created > 0) {
    clearCombustivelTipoCache();
  }

  return created;
}
