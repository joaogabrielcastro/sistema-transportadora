/** Formata opções de typeahead para seleção de veículo/caminhão. */

export const TIPO_VEICULO_LABEL = {
  truck: "Truck (rígido)",
  cavalo: "Cavalo (trator)",
  carreta: "Carreta / Semi-reboque",
};

/** Labels curtos para badges / listas. */
export const TIPO_VEICULO_SHORT = {
  truck: "truck",
  cavalo: "cavalo",
  carreta: "carreta",
};

/** Opções do typeahead de tipo de veículo. */
export const TIPO_VEICULO_OPTIONS = [
  {
    value: "truck",
    label: TIPO_VEICULO_LABEL.truck,
    searchText: "truck rigido caminhao",
  },
  {
    value: "cavalo",
    label: TIPO_VEICULO_LABEL.cavalo,
    searchText: "cavalo trator",
  },
  {
    value: "carreta",
    label: TIPO_VEICULO_LABEL.carreta,
    searchText: "carreta semi-reboque semi reboque",
  },
];

/**
 * @param {object} c - registro de caminhão/veículo
 * @param {{
 *   valueKey?: 'id' | 'placa',
 *   includeTipo?: boolean,
 *   includeKm?: boolean,
 *   includeMotorista?: boolean,
 * }} [opts]
 */
export function formatCaminhaoOption(c, opts = {}) {
  const valueKey = opts.valueKey || "id";
  const includeTipo = opts.includeTipo !== false;
  const includeKm = Boolean(opts.includeKm);
  const includeMotorista = opts.includeMotorista !== false;

  const placa = c?.placa || "";
  const tipo =
    TIPO_VEICULO_SHORT[c?.tipo_veiculo] || c?.tipo_veiculo || "";
  const modelo = c?.modelo || "";
  const marca = c?.marca || "";
  const motorista = c?.motorista || "";
  const km =
    c?.km_atual != null
      ? `KM: ${Number(c.km_atual).toLocaleString("pt-BR")}`
      : "";

  const parts = [placa];
  if (includeTipo && tipo) parts.push(tipo);
  if (modelo) parts.push(modelo);
  else if (marca) parts.push(marca);
  else if (includeMotorista && motorista) parts.push(motorista);
  else if (!modelo && !marca) parts.push("Sem motorista");
  if (includeKm && km) parts.push(km);

  const label = parts.join(" — ");
  const searchText = [
    placa,
    tipo,
    modelo,
    marca,
    motorista,
    c?.empresa,
    c?.chassi,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    value: valueKey === "placa" ? placa : String(c.id),
    label,
    searchText,
  };
}

export function formatCaminhaoOptions(list = [], opts = {}) {
  return (list || []).map((c) => formatCaminhaoOption(c, opts));
}
