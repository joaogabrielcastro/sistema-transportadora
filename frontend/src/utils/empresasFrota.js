/** Mesma convenção de caminhoes.empresa / notas / gastos no backend. */
export const EMPRESAS_FROTA = Object.freeze([
  "Solofino",
  "Colombocal",
  "Transmotin",
]);

export const EMPRESA_FROTA_OPTIONS = [
  { value: "", label: "Não informar" },
  ...EMPRESAS_FROTA.map((e) => ({ value: e, label: e })),
];
