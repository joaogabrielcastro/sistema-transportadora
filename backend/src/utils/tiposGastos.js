import prisma from "../lib/prisma.js";
import {
  DEFAULT_TIPOS_GASTOS,
  normalizeTipoGastoName,
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

/**
 * Garante tipos de gasto padrão (idempotente).
 * Respeita "Combustivel" legado sem acento — não duplica combustível.
 */
export async function ensureDefaultTiposGastos() {
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
