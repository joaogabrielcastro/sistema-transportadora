const normalizeTipoName = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function findCombustivelTipo(tiposGastos = []) {
  return (
    tiposGastos.find((t) => {
      const n = normalizeTipoName(t.nome_tipo);
      return n.includes("combust");
    }) ?? null
  );
}

export function isCombustivelTipo(tipoId, tiposGastos = []) {
  if (!tipoId) return false;
  const combustivel = findCombustivelTipo(tiposGastos);
  return combustivel != null && String(combustivel.id) === String(tipoId);
}

export function combustivelTipoId(tiposGastos = []) {
  return findCombustivelTipo(tiposGastos)?.id ?? null;
}

/** Tipos reservados ao fluxo de manutenção (checklist), não ao gasto financeiro. */
export function isManutencaoTipoGasto(nomeTipo) {
  const n = normalizeTipoName(nomeTipo);
  return n === "manutencao" || n === "manutenção";
}

export function tiposGastosFinanceiros(tiposGastos = []) {
  return tiposGastos.filter((t) => !isManutencaoTipoGasto(t.nome_tipo));
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
