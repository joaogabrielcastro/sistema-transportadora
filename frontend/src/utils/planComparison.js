/** Colunas da matriz de comparação (ordem exibida). */
export const COMPARE_PLAN_IDS = ["starter", "fiscal", "complete"];

export const COMPARE_PLAN_HEADERS = {
  starter: "Starter",
  fiscal: "Fiscal",
  complete: "Completo",
};

/**
 * Matriz de funcionalidades por plano.
 * Valor: true | false | string (texto curto)
 */
export const PLAN_COMPARE_SECTIONS = [
  {
    id: "frota",
    title: "Gestão da frota",
    rows: [
      {
        label: "Veículos na frota",
        starter: "Até 15",
        fiscal: "Até 40",
        complete: "Até 100",
      },
      {
        label: "Cadastro de caminhões, cavalos e carretas",
        starter: true,
        fiscal: true,
        complete: true,
      },
      {
        label: "Composição cavalo + carreta",
        starter: true,
        fiscal: true,
        complete: true,
      },
      {
        label: "Motoristas, CNH e validade",
        starter: true,
        fiscal: true,
        complete: true,
      },
      {
        label: "Controle de pneus e posições",
        starter: true,
        fiscal: true,
        complete: true,
      },
      {
        label: "Documentos do veículo",
        starter: true,
        fiscal: true,
        complete: true,
      },
    ],
  },
  {
    id: "custos",
    title: "Custos e manutenção",
    rows: [
      {
        label: "Gastos e abastecimento",
        starter: true,
        fiscal: true,
        complete: true,
      },
      {
        label: "Checklist e manutenção programada",
        starter: true,
        fiscal: true,
        complete: true,
      },
      {
        label: "Alertas de vencimento e km",
        starter: true,
        fiscal: true,
        complete: true,
      },
      {
        label: "Baixa de peças do estoque na manutenção",
        starter: false,
        fiscal: true,
        complete: true,
      },
    ],
  },
  {
    id: "fiscal",
    title: "Fiscal e estoque",
    rows: [
      {
        label: "Importação de XML da NF-e",
        starter: false,
        fiscal: true,
        complete: true,
      },
      {
        label: "Cadastro manual de notas",
        starter: false,
        fiscal: true,
        complete: true,
      },
      {
        label: "Estoque de peças ligado à frota",
        starter: false,
        fiscal: true,
        complete: true,
      },
      {
        label: "Ordem de coleta (PDF / e-mail) — exclusivo cliente ABroto",
        starter: false,
        fiscal: false,
        complete: false,
      },
    ],
  },
  {
    id: "relatorios",
    title: "Relatórios e indicadores",
    rows: [
      {
        label: "Relatório de custo por km",
        starter: true,
        fiscal: true,
        complete: true,
      },
      {
        label: "Visão consolidada de gastos e manutenção",
        starter: true,
        fiscal: true,
        complete: true,
      },
      {
        label: "Exportação PDF / planilha",
        starter: true,
        fiscal: true,
        complete: true,
      },
      {
        label: "Auditoria de alterações",
        starter: "Básico",
        fiscal: true,
        complete: true,
      },
    ],
  },
  {
    id: "equipe",
    title: "Equipe e plataforma",
    rows: [
      {
        label: "Usuários por empresa",
        starter: "Até 3",
        fiscal: "Até 8",
        complete: "Até 20",
      },
      {
        label: "Perfis admin / operador / leitura",
        starter: true,
        fiscal: true,
        complete: true,
      },
      {
        label: "Trial de 14 dias (Starter)",
        starter: true,
        fiscal: false,
        complete: false,
      },
      {
        label: "Suporte prioritário",
        starter: false,
        fiscal: false,
        complete: true,
      },
    ],
  },
];
