/** Formata gastos e manutenções em lista unificada para exibição. */
export function formatRegistros(gastosData, checklistData) {
  const gastosFormatados = (Array.isArray(gastosData) ? gastosData : []).map(
    (g) => ({
      ...g,
      tipo_registro: "Gasto",
      nome_tipo: g.tipos_gastos?.nome_tipo,
      placa: g.caminhoes?.placa,
      data: g.data_gasto,
      observacao: g.descricao,
      oficina: "N/A",
      km_registro: g.km_registro || "N/A",
      quantidade_combustivel: g.quantidade_combustivel || "N/A",
    }),
  );

  const checklistFormatados = (
    Array.isArray(checklistData) ? checklistData : []
  ).map((c) => ({
    ...c,
    tipo_registro: "Manutenção",
    nome_tipo: c.itens_checklist?.nome_item,
    placa: c.caminhoes?.placa,
    data: c.data_manutencao,
    valor: c.valor || "N/A",
    observacao: c.observacao,
    oficina: c.oficina || "N/A",
    km_registro: c.km_manutencao || "N/A",
    quantidade_combustivel: "N/A",
  }));

  return [...gastosFormatados, ...checklistFormatados].sort(compareByDateDesc);
}

function toTime(value) {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function endOfTodayMs() {
  const n = new Date();
  n.setHours(23, 59, 59, 999);
  return n.getTime();
}

/** Datas futuras no fim; depois data desc; empate por id desc. */
export function compareByDateDesc(a, b) {
  const todayEnd = endOfTodayMs();
  let ta = toTime(a.data);
  let tb = toTime(b.data);
  const aFuture = ta != null && ta > todayEnd;
  const bFuture = tb != null && tb > todayEnd;
  if (aFuture !== bFuture) return aFuture ? 1 : -1;
  ta = ta ?? Number.NEGATIVE_INFINITY;
  tb = tb ?? Number.NEGATIVE_INFINITY;
  if (tb !== ta) return tb - ta;
  return (Number(b.id) || 0) - (Number(a.id) || 0);
}

/** Registros resumidos para abas de detalhe do caminhão. */
export function formatCaminhaoRegistros(gastos = [], checklists = []) {
  const gastosRows = gastos.map((g) => ({
    id: g.id,
    tipo: "gasto",
    tipo_registro: "Gasto",
    descricao: g.tipos_gastos?.nome_tipo,
    data: g.data_gasto,
    valor: g.valor,
    km: g.km_registro,
    raw: g,
  }));

  const checklistRows = checklists.map((c) => ({
    id: c.id,
    tipo: "manutencao",
    tipo_registro: "Manutenção",
    descricao: c.itens_checklist?.nome_item,
    data: c.data_manutencao,
    valor: c.valor,
    km: c.km_manutencao,
    raw: c,
  }));

  return [...gastosRows, ...checklistRows].sort(compareByDateDesc);
}
