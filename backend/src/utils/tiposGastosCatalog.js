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
