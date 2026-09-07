const normalizeTipoName = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function findCombustivelTipo(tiposGastos = []) {
  return (
    tiposGastos.find((t) => classifyTipoGasto(t.nome_tipo) === "combustivel") ??
    null
  );
}

export function isCombustivelTipo(tipoId, tiposGastos = []) {
  if (!tipoId) return false;
  const tipo = tiposGastos.find((t) => String(t.id) === String(tipoId));
  return classifyTipoGasto(tipo?.nome_tipo) === "combustivel";
}

export function combustivelTipoId(tiposGastos = []) {
  return findCombustivelTipo(tiposGastos)?.id ?? null;
}

/** Tipos reservados ao fluxo de manutenção (checklist), não ao gasto financeiro. */
export function isManutencaoTipoGasto(nomeTipo) {
  const n = normalizeTipoName(nomeTipo);
  return n === "manutencao" || n === "manutenção";
}

function preferTipoGasto(a, b) {
  const accent = (s) => /[áàâãéêíóôõúç]/i.test(String(s || ""));
  if (accent(a.nome_tipo) !== accent(b.nome_tipo)) {
    return accent(a.nome_tipo) ? a : b;
  }
  return Number(a.id) <= Number(b.id) ? a : b;
}

export function tiposGastosFinanceiros(tiposGastos = []) {
  const financeiros = tiposGastos.filter(
    (t) => !isManutencaoTipoGasto(t.nome_tipo),
  );
  const byKey = new Map();
  for (const t of financeiros) {
    const key = normalizeTipoName(t.nome_tipo);
    const prev = byKey.get(key);
    byKey.set(key, prev ? preferTipoGasto(prev, t) : t);
  }
  return [...byKey.values()];
}

/**
 * Família do tipo de gasto (multa, pedagio, combustivel, …) a partir do nome.
 * @param {string} nomeTipo
 */
export function classifyTipoGasto(nomeTipo) {
  const n = normalizeTipoName(nomeTipo);
  if (n.includes("multa")) return "multa";
  if (n.includes("pedagio")) return "pedagio";
  if (n.includes("combust")) return "combustivel";
  if (n.includes("seguro")) return "seguro";
  if (n.includes("ipva") || n.includes("licenci")) return "ipva";
  if (n.includes("salario") || n.includes("diaria")) return "salario";
  if (n.includes("aliment")) return "alimentacao";
  if (n.includes("hosped")) return "hospedagem";
  if (n.includes("estacion")) return "estacionamento";
  if (n.includes("lavagem")) return "lavagem";
  if (n.includes("peca")) return "pecas";
  return "outros";
}

export function classifyTipoGastoById(tipoId, tiposGastos = []) {
  const tipo = tiposGastos.find((t) => String(t.id) === String(tipoId));
  return classifyTipoGasto(tipo?.nome_tipo);
}
