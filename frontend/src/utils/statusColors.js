export const getStatusConfig = (statusName, type = "status") => {
  const configs = {
    status: {
      // STATUS EM USO (Verde)
      "em uso": "bg-green-50 text-green-700 border-green-200",
      "recapado em uso": "bg-green-50 text-green-700 border-green-200",

      // STATUS ESTOQUE (Azul)
      "novo no estoque": "bg-blue-50 text-blue-700 border-blue-200",
      "reservado para veículo": "bg-blue-50 text-blue-700 border-blue-200",
      "instalação agendada": "bg-blue-50 text-blue-700 border-blue-200",
      "aprovado para uso": "bg-blue-50 text-blue-700 border-blue-200",
      "recapado no estoque": "bg-blue-50 text-blue-700 border-blue-200",

      // STATUS MANUTENÇÃO (Amarelo/Laranja)
      "em manutenção": "bg-yellow-50 text-yellow-700 border-yellow-200",
      "aguardando inspeção": "bg-yellow-50 text-yellow-700 border-yellow-200",
      "reprovado - enviar para recapagem":
        "bg-orange-50 text-orange-700 border-orange-200",
      "enviado para recapagem":
        "bg-orange-50 text-orange-700 border-orange-200",

      // STATUS DESCARTE (Vermelho)
      "enviado para descarte": "bg-red-50 text-red-700 border-red-200",
      sucata: "bg-red-50 text-red-700 border-red-200",
      "perdido/roubado": "bg-red-50 text-red-700 border-red-200",

      // STATUS FISCAL CT-e / MDF-e
      rascunho: "bg-slate-50 text-slate-700 border-slate-200",
      pendente: "bg-slate-50 text-slate-700 border-slate-200",
      processando: "bg-yellow-50 text-yellow-700 border-yellow-200",
      processado: "bg-green-50 text-green-700 border-green-200",
      rejeitado: "bg-orange-50 text-orange-700 border-orange-200",
      cancelado: "bg-red-50 text-red-700 border-red-200",
      encerrado: "bg-blue-50 text-blue-700 border-blue-200",
      erro: "bg-red-50 text-red-700 border-red-200",
      ativo: "bg-green-50 text-green-700 border-green-200",
      em_andamento: "bg-yellow-50 text-yellow-700 border-yellow-200",
      "em andamento": "bg-yellow-50 text-yellow-700 border-yellow-200",
      concluido: "bg-blue-50 text-blue-700 border-blue-200",
      concluído: "bg-blue-50 text-blue-700 border-blue-200",
      registrado: "bg-green-50 text-green-700 border-green-200",
      registrando: "bg-yellow-50 text-yellow-700 border-yellow-200",
      nao_registrado: "bg-slate-50 text-slate-700 border-slate-200",
      "não registrado": "bg-slate-50 text-slate-700 border-slate-200",
      "erro no registro": "bg-red-50 text-red-700 border-red-200",

      crítico: "bg-red-50 text-red-700 border-red-200",
      critico: "bg-red-50 text-red-700 border-red-200",
      alto: "bg-orange-50 text-orange-700 border-orange-200",
      médio: "bg-yellow-50 text-yellow-700 border-yellow-200",
      medio: "bg-yellow-50 text-yellow-700 border-yellow-200",
      vencido: "bg-red-50 text-red-700 border-red-200",
      "≤ 7 dias": "bg-red-50 text-red-700 border-red-200",
      "≤ 30 dias": "bg-yellow-50 text-yellow-700 border-yellow-200",
      "em dia": "bg-green-50 text-green-700 border-green-200",
      "sem validade": "bg-slate-50 text-slate-600 border-slate-200",

      // Averbação de seguro
      pending: "bg-slate-50 text-slate-700 border-slate-200",
      processing: "bg-yellow-50 text-yellow-700 border-yellow-200",
      averbed: "bg-green-50 text-green-700 border-green-200",
      rejected: "bg-orange-50 text-orange-700 border-orange-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
      error: "bg-red-50 text-red-700 border-red-200",

      default: "bg-gray-50 text-gray-700 border-gray-200",
    },
    vehicle: {
      ativo: "bg-green-50 text-green-700 border-green-200",
      operacional: "bg-green-50 text-green-700 border-green-200",
      "em operação": "bg-green-50 text-green-700 border-green-200",
      inativo: "bg-gray-50 text-gray-600 border-gray-200",
      parado: "bg-yellow-50 text-yellow-700 border-yellow-200",
      manutenção: "bg-orange-50 text-orange-700 border-orange-200",
      default: "bg-slate-50 text-slate-600 border-slate-200",
    },
    record: {
      gasto: "bg-blue-50 text-blue-700 border-blue-200",
      manutenção: "bg-green-50 text-green-700 border-green-200",
      default: "bg-gray-50 text-gray-700 border-gray-200",
    },
    position: {
      default: "bg-purple-50 text-purple-700 border-purple-200",
    },
    payment: {
      pago: "bg-green-50 text-green-700 border-green-200",
      pendente: "bg-yellow-50 text-yellow-700 border-yellow-200",
      "em recurso": "bg-orange-50 text-orange-700 border-orange-200",
      em_recurso: "bg-orange-50 text-orange-700 border-orange-200",
      cancelado: "bg-red-50 text-red-700 border-red-200",
      default: "bg-gray-50 text-gray-700 border-gray-200",
    },
  };

  const configType = configs[type] || configs.status;
  const statusLower = statusName?.toLowerCase();

  return configType[statusLower] || configType.default;
};
