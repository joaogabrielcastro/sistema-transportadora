export const getStatusConfig = (statusName, type = "status") => {
  const configs = {
    status: {
      // STATUS EM USO (Verde)
      "em uso": "bg-green-100 text-green-800 border-green-200",
      "recapado em uso": "bg-green-100 text-green-800 border-green-200",

      // STATUS ESTOQUE (Azul)
      "novo no estoque": "bg-blue-100 text-blue-800 border-blue-200",
      "reservado para veículo": "bg-blue-100 text-blue-800 border-blue-200",
      "instalação agendada": "bg-blue-100 text-blue-800 border-blue-200",
      "aprovado para uso": "bg-blue-100 text-blue-800 border-blue-200",
      "recapado no estoque": "bg-blue-100 text-blue-800 border-blue-200",

      // STATUS MANUTENÇÃO (Amarelo/Laranja)
      "em manutenção": "bg-yellow-100 text-yellow-800 border-yellow-200",
      "aguardando inspeção": "bg-yellow-100 text-yellow-800 border-yellow-200",
      "reprovado - enviar para recapagem":
        "bg-orange-100 text-orange-800 border-orange-200",
      "enviado para recapagem":
        "bg-orange-100 text-orange-800 border-orange-200",

      // STATUS DESCARTE (Vermelho)
      "enviado para descarte": "bg-red-100 text-red-800 border-red-200",
      sucata: "bg-red-100 text-red-800 border-red-200",
      "perdido/roubado": "bg-red-100 text-red-800 border-red-200",

      default: "bg-gray-100 text-gray-800 border-gray-200",
    },
    position: {
      default: "bg-purple-100 text-purple-800 border-purple-200",
    },
  };

  const configType = configs[type] || configs.status;
  const statusLower = statusName?.toLowerCase();

  return configType[statusLower] || configType.default;
};
