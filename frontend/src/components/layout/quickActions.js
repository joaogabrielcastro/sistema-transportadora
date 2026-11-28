import { PERMISSIONS, userHasPermission } from "../../utils/permissions.js";
import { isVehicleQuotaReached } from "../../utils/billing.js";

/**
 * Ações de criação mais frequentes do dia a dia. Exibidas no botão "Novo" do
 * topo, na busca rápida e no painel. Respeitam permissões e cota do plano.
 */
export function quickActionsFor(user) {
  const actions = [];
  if (
    userHasPermission(user, [PERMISSIONS.VIAGENS_READ, PERMISSIONS.VIAGENS_CREATE])
  ) {
    actions.push({
      id: "viagem",
      label: "Nova viagem",
      description: "Saída do caminhão com motorista e destino",
      icon: "route",
      to: "/viagens?nova=1",
      keywords: "viagem saida operacao frete",
    });
  }
  if (userHasPermission(user, PERMISSIONS.GASTOS_WRITE)) {
    actions.push({
      id: "gasto",
      label: "Lançar gasto",
      description: "Combustível, pedágio, multa e demais despesas",
      icon: "fuel",
      to: "/manutencao-gastos?novo=gasto",
      keywords: "abastecimento despesa combustivel",
    });
    actions.push({
      id: "manutencao",
      label: "Registrar manutenção",
      description: "Serviço de oficina com lembrete da próxima",
      icon: "wrench",
      to: "/manutencao-gastos?novo=manutencao",
      keywords: "oficina checklist revisao troca de oleo",
    });
  }
  if (
    userHasPermission(user, PERMISSIONS.FROTA_WRITE) &&
    !isVehicleQuotaReached(user)
  ) {
    actions.push({
      id: "veiculo",
      label: "Cadastrar veículo",
      description: "Truck, cavalo ou carreta",
      icon: "truck",
      to: "/cadastro-caminhao",
      keywords: "caminhao placa novo",
    });
  }
  if (userHasPermission(user, PERMISSIONS.MOTORISTAS_WRITE)) {
    actions.push({
      id: "motorista",
      label: "Cadastrar motorista",
      description: "Dados pessoais e validade da CNH",
      icon: "user",
      to: "/motoristas?novo=1",
      keywords: "condutor cnh",
    });
  }
  if (userHasPermission(user, PERMISSIONS.PNEUS_WRITE)) {
    actions.push({
      id: "pneus",
      label: "Instalar pneus",
      description: "Atribuir pneus do estoque a um veículo",
      icon: "tire",
      to: "/pneus/atribuir",
      keywords: "atribuir montar",
    });
  }
  return actions;
}
