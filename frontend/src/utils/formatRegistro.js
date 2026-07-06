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

  return [...gastosFormatados, ...checklistFormatados].sort(
    (a, b) => new Date(b.data) - new Date(a.data),
  );
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

  return [...gastosRows, ...checklistRows].sort(
    (a, b) => new Date(b.data) - new Date(a.data),
  );
}
