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
