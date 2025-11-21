// frontend/src/utils/constants.js

// Status do caminhão
export const CAMINHAO_STATUS = {
  ATIVO: "ativo",
  INATIVO: "inativo",
  MANUTENCAO: "manutencao",
};

export const CAMINHAO_STATUS_LABELS = {
  [CAMINHAO_STATUS.ATIVO]: "Ativo",
  [CAMINHAO_STATUS.INATIVO]: "Inativo",
  [CAMINHAO_STATUS.MANUTENCAO]: "Em Manutenção",
};

export const CAMINHAO_STATUS_COLORS = {
  [CAMINHAO_STATUS.ATIVO]: "green",
  [CAMINHAO_STATUS.INATIVO]: "gray",
  [CAMINHAO_STATUS.MANUTENCAO]: "yellow",
};

// Tipos de combustível
export const COMBUSTIVEL_TIPOS = {
  DIESEL: "diesel",
  GASOLINA: "gasolina",
  ETANOL: "etanol",
  GNV: "gnv",
};

export const COMBUSTIVEL_LABELS = {
  [COMBUSTIVEL_TIPOS.DIESEL]: "Diesel",
  [COMBUSTIVEL_TIPOS.GASOLINA]: "Gasolina",
  [COMBUSTIVEL_TIPOS.ETANOL]: "Etanol",
  [COMBUSTIVEL_TIPOS.GNV]: "GNV",
};

// Tipos de gastos
export const GASTO_CATEGORIAS = {
  COMBUSTIVEL: "combustivel",
  MANUTENCAO: "manutencao",
  SEGURO: "seguro",
  LICENCIAMENTO: "licenciamento",
  MULTA: "multa",
  PEDAGIO: "pedagio",
  OUTROS: "outros",
};

export const GASTO_CATEGORIA_LABELS = {
  [GASTO_CATEGORIAS.COMBUSTIVEL]: "Combustível",
  [GASTO_CATEGORIAS.MANUTENCAO]: "Manutenção",
  [GASTO_CATEGORIAS.SEGURO]: "Seguro",
  [GASTO_CATEGORIAS.LICENCIAMENTO]: "Licenciamento",
  [GASTO_CATEGORIAS.MULTA]: "Multa",
  [GASTO_CATEGORIAS.PEDAGIO]: "Pedágio",
  [GASTO_CATEGORIAS.OUTROS]: "Outros",
};

// Status dos pneus
export const PNEU_STATUS = {
  NOVO: "novo",
  BOM: "bom",
  REGULAR: "regular",
  RUIM: "ruim",
  DESCARTADO: "descartado",
};

export const PNEU_STATUS_LABELS = {
  [PNEU_STATUS.NOVO]: "Novo",
  [PNEU_STATUS.BOM]: "Bom",
  [PNEU_STATUS.REGULAR]: "Regular",
  [PNEU_STATUS.RUIM]: "Ruim",
  [PNEU_STATUS.DESCARTADO]: "Descartado",
};

export const PNEU_STATUS_COLORS = {
  [PNEU_STATUS.NOVO]: "blue",
  [PNEU_STATUS.BOM]: "green",
  [PNEU_STATUS.REGULAR]: "yellow",
  [PNEU_STATUS.RUIM]: "red",
  [PNEU_STATUS.DESCARTADO]: "gray",
};

// Posições dos pneus
export const PNEU_POSICOES = {
  DIANTEIRO_ESQUERDO: "dianteiro_esquerdo",
  DIANTEIRO_DIREITO: "dianteiro_direito",
  TRASEIRO_ESQUERDO_EXTERNO: "traseiro_esquerdo_externo",
  TRASEIRO_ESQUERDO_INTERNO: "traseiro_esquerdo_interno",
  TRASEIRO_DIREITO_EXTERNO: "traseiro_direito_externo",
  TRASEIRO_DIREITO_INTERNO: "traseiro_direito_interno",
  ESTEPE: "estepe",
};

export const PNEU_POSICAO_LABELS = {
  [PNEU_POSICOES.DIANTEIRO_ESQUERDO]: "Dianteiro Esquerdo",
  [PNEU_POSICOES.DIANTEIRO_DIREITO]: "Dianteiro Direito",
  [PNEU_POSICOES.TRASEIRO_ESQUERDO_EXTERNO]: "Traseiro Esquerdo Externo",
  [PNEU_POSICOES.TRASEIRO_ESQUERDO_INTERNO]: "Traseiro Esquerdo Interno",
  [PNEU_POSICOES.TRASEIRO_DIREITO_EXTERNO]: "Traseiro Direito Externo",
  [PNEU_POSICOES.TRASEIRO_DIREITO_INTERNO]: "Traseiro Direito Interno",
  [PNEU_POSICOES.ESTEPE]: "Estepe",
};

// Status do checklist
export const CHECKLIST_STATUS = {
  PENDENTE: "pendente",
  EM_ANDAMENTO: "em_andamento",
  CONCLUIDO: "concluido",
  CANCELADO: "cancelado",
};

export const CHECKLIST_STATUS_LABELS = {
  [CHECKLIST_STATUS.PENDENTE]: "Pendente",
  [CHECKLIST_STATUS.EM_ANDAMENTO]: "Em Andamento",
  [CHECKLIST_STATUS.CONCLUIDO]: "Concluído",
  [CHECKLIST_STATUS.CANCELADO]: "Cancelado",
};

export const CHECKLIST_STATUS_COLORS = {
  [CHECKLIST_STATUS.PENDENTE]: "yellow",
  [CHECKLIST_STATUS.EM_ANDAMENTO]: "blue",
  [CHECKLIST_STATUS.CONCLUIDO]: "green",
  [CHECKLIST_STATUS.CANCELADO]: "red",
};

// Configurações de paginação
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [5, 10, 20, 50],
  MAX_PAGE_SIZE: 100,
};

// Configurações de API
export const API_CONFIG = {
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// Regex patterns
export const REGEX_PATTERNS = {
  PLACA_ANTIGA: /^[A-Z]{3}-?[0-9]{4}$/,
  PLACA_MERCOSUL: /^[A-Z]{3}[0-9]{1}[A-Z]{1}[0-9]{2}$/,
  CPF: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  CNPJ: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
  TELEFONE: /^\(\d{2}\)\s\d{4,5}-\d{4}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

// Mensagens de erro padrão
export const ERROR_MESSAGES = {
  REQUIRED: "Campo obrigatório",
  INVALID_EMAIL: "Email inválido",
  INVALID_CPF: "CPF inválido",
  INVALID_CNPJ: "CNPJ inválido",
  INVALID_PHONE: "Telefone inválido",
  INVALID_PLACA: "Placa inválida",
  SERVER_ERROR: "Erro no servidor. Tente novamente.",
  NETWORK_ERROR: "Erro de conexão. Verifique sua internet.",
  UNAUTHORIZED: "Acesso não autorizado",
  NOT_FOUND: "Recurso não encontrado",
  VALIDATION_ERROR: "Dados inválidos",
};

// Mensagens de sucesso padrão
export const SUCCESS_MESSAGES = {
  CREATED: "Registro criado com sucesso!",
  UPDATED: "Registro atualizado com sucesso!",
  DELETED: "Registro removido com sucesso!",
  SAVED: "Dados salvos com sucesso!",
};

// Configurações de localStorage
export const STORAGE_KEYS = {
  USER_PREFERENCES: "user_preferences",
  LAST_SEARCH: "last_search",
  PAGE_SIZE: "page_size",
  THEME: "theme",
};

// Configurações de tema
export const THEME = {
  PRIMARY: "blue",
  SECONDARY: "gray",
  SUCCESS: "green",
  WARNING: "yellow",
  ERROR: "red",
};
