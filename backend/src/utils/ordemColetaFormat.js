export const str = (v) => {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
};

/** Converte yyyy-mm-dd (input date) para dd/mm/aaaa no PDF. */
export const formatDateBr = (value) => {
  const s = str(value);
  if (!s) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s;
};

export const finalizeOrdemVars = (vars) => {
  vars.data_coleta_prevista = formatDateBr(vars.data_coleta_prevista);
  vars.validade_ate = formatDateBr(vars.validade_ate);

  const horaPrev = str(vars.horario_previsto_coleta);
  const dataPrev = str(vars.data_coleta_prevista);
  const coletaPartes = [];
  if (dataPrev) coletaPartes.push(dataPrev);
  if (horaPrev) coletaPartes.push(horaPrev);
  vars.coleta_prevista_exibicao =
    coletaPartes.join(" às ") || str(vars.local_coleta) || "A definir";

  const carretas = [vars.placa_carreta_1, vars.placa_carreta_2]
    .map(str)
    .filter(Boolean);
  vars.placas_carretas_exibicao = carretas.length ? carretas.join(" / ") : "";

  if (!str(vars.horario_chegada_coleta)) {
    vars.horario_chegada_coleta = "____:____";
  }
  if (!str(vars.horario_saida_coleta)) {
    vars.horario_saida_coleta = "____:____";
  }

  return vars;
};
