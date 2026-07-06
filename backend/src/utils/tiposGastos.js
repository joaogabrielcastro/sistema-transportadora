import prisma from "../lib/prisma.js";

const COMBUSTIVEL_NAMES = ["combustível", "combustivel", "combust"];

let cachedCombustivelId = null;

export async function resolveCombustivelTipoId() {
  if (cachedCombustivelId != null) return cachedCombustivelId;

  const tipos = await prisma.tipos_gastos.findMany({
    select: { id: true, nome_tipo: true },
  });

  const found = tipos.find((t) => {
    const n = String(t.nome_tipo || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return COMBUSTIVEL_NAMES.some((key) => n.includes(key));
  });

  cachedCombustivelId = found?.id ?? null;
  return cachedCombustivelId;
}

export function clearCombustivelTipoCache() {
  cachedCombustivelId = null;
}
