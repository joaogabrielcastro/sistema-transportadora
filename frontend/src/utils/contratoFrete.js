export const CONTRATO_STATUS_LABEL = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const CIOT_STATUS_LABEL = {
  nao_registrado: "Não registrado",
  registrando: "Registrando",
  registrado: "Registrado",
  erro: "Erro no registro",
  cancelado: "Cancelado",
  encerrado: "Encerrado",
};

export function labelStatusContrato(status) {
  return CONTRATO_STATUS_LABEL[status] || status || "—";
}

export function labelStatusCiot(status) {
  return CIOT_STATUS_LABEL[status] || status || "Não registrado";
}

export function numeroCiotDoContrato(contrato) {
  const ciot = contrato?.ciot;
  const n = String(
    ciot?.numero ||
      ciot?.codigo_identificacao_operacao ||
      contrato?.codigo_identificacao_operacao ||
      "",
  ).replace(/\D/g, "");
  return n || "";
}

export function ciotRegistradoNoContrato(contrato) {
  const status = contrato?.ciot?.status || contrato?.ciot_status;
  return status === "registrado" && Boolean(numeroCiotDoContrato(contrato));
}
