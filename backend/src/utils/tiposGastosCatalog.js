/** Tipos de gasto padrão do sistema (ordem de exibição). */
export const DEFAULT_TIPOS_GASTOS = [
  "Combustível",
  "Pedágio",
  "Multa",
  "Manutenção",
  "Peças",
  "Lavagem",
  "Estacionamento",
  "Seguro",
  "IPVA / Licenciamento",
  "Salário / Diária",
  "Alimentação",
  "Hospedagem",
  "Outros",
];

/** @param {string} value */
export function normalizeTipoGastoName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const ORDER_INDEX = new Map(
  DEFAULT_TIPOS_GASTOS.map((nome, index) => [normalizeTipoGastoName(nome), index]),
);

/** Ordena tipos: catálogo primeiro, depois alfabético. */
export function sortTiposGastos(tipos = []) {
  return [...tipos].sort((a, b) => {
    const ia = ORDER_INDEX.get(normalizeTipoGastoName(a.nome_tipo)) ?? 999;
    const ib = ORDER_INDEX.get(normalizeTipoGastoName(b.nome_tipo)) ?? 999;
    if (ia !== ib) return ia - ib;
    return String(a.nome_tipo || "").localeCompare(String(b.nome_tipo || ""), "pt-BR");
  });
}

/** Escolhe o registro a manter quando há nomes equivalentes (ex.: Combustivel / Combustível). */
export function selectCanonicalTipo(list = []) {
  if (!Array.isArray(list) || !list.length) return null;
  const catalogHit = list.find((t) => DEFAULT_TIPOS_GASTOS.includes(t.nome_tipo));
  if (catalogHit) return catalogHit;
  return [...list].sort((a, b) => Number(a.id) - Number(b.id))[0];
}

/** Remove duplicatas pelo nome normalizado (acento, caixa). */
export function dedupeTiposGastos(tipos = []) {
  const groups = new Map();
  for (const t of tipos) {
    const key = normalizeTipoGastoName(t.nome_tipo);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const kept = [];
  for (const list of groups.values()) {
    const canonical = selectCanonicalTipo(list);
    if (canonical) kept.push(canonical);
  }
  return sortTiposGastos(kept);
}
