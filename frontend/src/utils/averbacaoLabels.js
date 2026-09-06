/**
 * Rótulos da averbação de seguro (status interno ATrack).
 */
export const AVERBACAO_STATUS_LABEL = {
  pending: "Pendente",
  processing: "Processando",
  averbed: "Averbado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  error: "Erro na averbação",
};

export const AVERBACAO_PROVIDER_LABEL = {
  atm: "AT&M",
};

export function averbacaoStatusLabel(status) {
  return AVERBACAO_STATUS_LABEL[status] || status || "—";
}

export function averbacaoProviderLabel(provider) {
  return AVERBACAO_PROVIDER_LABEL[provider] || provider || "—";
}

export function averbacaoPodeReprocessar(status) {
  return status === "error" || status === "pending" || status === "rejected";
}

export function averbacaoIsErro(status) {
  return status === "error" || status === "rejected";
}

export function averbacaoIsOk(status) {
  return status === "averbed";
}
