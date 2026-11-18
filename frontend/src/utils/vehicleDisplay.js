/** Rótulos e textos de exibição de veículos (sem regra de negócio). */

export const TIPO_VEICULO_LABEL = {
  truck: "Truck",
  cavalo: "Cavalo",
  carreta: "Carreta",
};

export function tipoVeiculoLabel(tipo) {
  if (!tipo) return "Truck";
  return TIPO_VEICULO_LABEL[String(tipo).toLowerCase()] || String(tipo);
}

/** Carretas vinculadas ao cavalo/truck (composição ativa ou campos legados). */
export function carretasVinculadas(caminhao) {
  const tipo = String(caminhao?.tipo_veiculo || "").toLowerCase();
  if (tipo !== "cavalo" && tipo !== "truck") return [];

  const vinculos = Array.isArray(caminhao?.composicao?.vinculos)
    ? caminhao.composicao.vinculos.filter((v) => v?.ativo !== false)
    : [];

  if (vinculos.length) {
    return vinculos.map((v, index) => ({
      ordem: v.ordem ?? index + 1,
      placa: v.carreta?.placa || "—",
      modelo: String(v.carreta?.modelo || "").trim(),
    }));
  }

  return [caminhao?.placa_carreta_1, caminhao?.placa_carreta_2]
    .map((placa) => String(placa || "").trim())
    .filter(Boolean)
    .map((placa, index) => ({ ordem: index + 1, placa, modelo: "" }));
}

/** Texto curto "1ª — ABC1D23 Modelo" (mantido para cards e testes existentes). */
export function carretasVinculadasTexto(caminhao) {
  return carretasVinculadas(caminhao).map(({ ordem, placa, modelo }) =>
    modelo ? `${ordem}ª — ${placa} ${modelo}` : `${ordem}ª — ${placa}`,
  );
}
