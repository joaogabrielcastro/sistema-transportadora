type ListParams = Record<string, unknown>;

export const queryKeys = {
  caminhoes: {
    all: ["caminhoes"] as const,
    list: (params: ListParams) => ["caminhoes", "list", params] as const,
    byPlaca: (placa: string) => ["caminhoes", "by-placa", placa] as const,
    detail: (placa: string) => ["caminhoes", "detail", placa] as const,
    documentos: (placa: string) => ["caminhoes", "documentos", placa] as const,
    search: (term: string) => ["caminhoes", "search", term] as const,
  },
  reports: {
    overview: ["reports", "overview"] as const,
    costPerKm: (params: ListParams) =>
      ["reports", "cost-per-km", params] as const,
  },
  gastos: {
    all: ["gastos"] as const,
    list: (params: ListParams) => ["gastos", "list", params] as const,
    detail: (id: number | string) => ["gastos", "detail", id] as const,
    byCaminhao: (id: number | string, params: ListParams) =>
      ["gastos", "by-caminhao", id, params] as const,
    consumo: (id: number | string) => ["gastos", "consumo", id] as const,
  },
  checklist: {
    all: ["checklist"] as const,
    list: (params: ListParams) => ["checklist", "list", params] as const,
    detail: (id: number | string) => ["checklist", "detail", id] as const,
    byCaminhao: (id: number | string, params: ListParams) =>
      ["checklist", "by-caminhao", id, params] as const,
  },
  pneus: {
    all: ["pneus"] as const,
    emUso: (params: ListParams) => ["pneus", "em-uso", params] as const,
    estoque: (params: ListParams) => ["pneus", "estoque", params] as const,
    detail: (id: number | string) => ["pneus", "detail", id] as const,
    byCaminhao: (id: number | string, params: ListParams) =>
      ["pneus", "by-caminhao", id, params] as const,
    status: ["pneus", "status"] as const,
    posicoes: ["pneus", "posicoes"] as const,
  },
  manutencaoMeta: {
    all: ["manutencao-meta"] as const,
    itens: ["manutencao-meta", "itens-checklist"] as const,
    tipos: ["manutencao-meta", "tipos-gastos"] as const,
  },
  ordemColeta: {
    all: ["ordem-coleta"] as const,
    historico: (page: number) => ["ordem-coleta", "historico", page] as const,
  },
  registros: {
    all: ["registros"] as const,
    list: (params: ListParams) => ["registros", "list", params] as const,
  },
};
