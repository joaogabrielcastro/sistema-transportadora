export const queryKeys = {
  caminhoes: {
    all: ["caminhoes"],
    list: (params) => ["caminhoes", "list", params],
    detail: (placa) => ["caminhoes", "detail", placa],
    search: (term) => ["caminhoes", "search", term],
  },
  reports: {
    overview: ["reports", "overview"],
  },
  gastos: {
    all: ["gastos"],
    list: (params) => ["gastos", "list", params],
    detail: (id) => ["gastos", "detail", id],
    byCaminhao: (id, params) => ["gastos", "by-caminhao", id, params],
    consumo: (id) => ["gastos", "consumo", id],
  },
  checklist: {
    all: ["checklist"],
    list: (params) => ["checklist", "list", params],
    detail: (id) => ["checklist", "detail", id],
    byCaminhao: (id, params) => ["checklist", "by-caminhao", id, params],
  },
  pneus: {
    all: ["pneus"],
    emUso: (params) => ["pneus", "em-uso", params],
    estoque: (params) => ["pneus", "estoque", params],
    detail: (id) => ["pneus", "detail", id],
    byCaminhao: (id, params) => ["pneus", "by-caminhao", id, params],
    status: ["pneus", "status"],
    posicoes: ["pneus", "posicoes"],
  },
  manutencaoMeta: {
    all: ["manutencao-meta"],
    itens: ["manutencao-meta", "itens-checklist"],
    tipos: ["manutencao-meta", "tipos-gastos"],
  },
  ordemColeta: {
    all: ["ordem-coleta"],
    historico: (page) => ["ordem-coleta", "historico", page],
  },
};
