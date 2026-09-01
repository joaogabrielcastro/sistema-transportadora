import { FIELD_LIMITS } from "./fieldLimits.js";

/** Campos que alimentam placeholders {{chave}} nos templates HTML do backend. */
export const ORDEM_COLETA_CAMPOS_PADRAO = [
  {
    key: "numero_pedido",
    label: "Nº ordem / referência (ex.: 17481 / 6020)",
    maxLength: FIELD_LIMITS.ORDEM_CAMPO_TEXTO,
  },
  {
    key: "motorista_cpf",
    label: "CPF do motorista",
    mask: "cpf",
  },
  {
    key: "tipo_veiculo",
    label: "Tipo de veículo (ex.: SIDER / SAIDER)",
    maxLength: FIELD_LIMITS.ORDEM_CAMPO_TEXTO,
  },
  {
    key: "local_coleta",
    label: "Local / cliente da coleta",
    maxLength: FIELD_LIMITS.ORDEM_CAMPO_TEXTO,
  },
  {
    key: "endereco_completo",
    label: "Endereço completo",
    maxLength: FIELD_LIMITS.ORDEM_CAMPO_TEXTO,
  },
  {
    key: "cidade_uf",
    label: "Cidade / UF",
    maxLength: 80,
  },
  {
    key: "contato_local",
    label: "Contato no local",
    maxLength: FIELD_LIMITS.ORDEM_CAMPO_TEXTO,
  },
  {
    key: "telefone_coleta",
    label: "Telefone / celular motorista",
    mask: "phone",
  },
  {
    key: "mercadoria",
    label: "Mercadoria / descrição da carga",
    maxLength: FIELD_LIMITS.ORDEM_CAMPO_TEXTO,
  },
  {
    key: "data_coleta_prevista",
    label: "Data prevista da coleta",
    type: "date",
  },
  {
    key: "horario_previsto_coleta",
    label: "Horário previsto",
    type: "time",
  },
  {
    key: "observacoes_gerais",
    label: "Observações",
    type: "textarea",
    rows: 3,
    maxLength: FIELD_LIMITS.ORDEM_CAMPO_TEXTAREA,
  },
];

export const ORDEM_COLETA_CAMPOS_AUTORIZACAO_COMPACTA = [
  {
    key: "razao_social",
    label: "Cliente — razão social",
    maxLength: FIELD_LIMITS.ORDEM_CAMPO_TEXTO,
  },
  {
    key: "cliente_endereco_linha1",
    label: "Cliente — endereço (linha 1, ex.: rua e bairro)",
    maxLength: FIELD_LIMITS.ORDEM_CAMPO_TEXTO,
  },
  {
    key: "cliente_endereco_linha2",
    label: "Cliente — cidade / UF / CEP (linha 2)",
    maxLength: FIELD_LIMITS.ORDEM_CAMPO_TEXTO,
  },
  {
    key: "fornecedor_nome",
    label: "Fornecedor / local de retirada",
    maxLength: FIELD_LIMITS.ORDEM_CAMPO_TEXTO,
  },
  {
    key: "fornecedor_cnpj",
    label: "Fornecedor — CNPJ",
    mask: "cnpj",
  },
  {
    key: "fornecedor_endereco",
    label: "Fornecedor — endereço completo",
    maxLength: FIELD_LIMITS.ORDEM_CAMPO_TEXTO,
  },
  {
    key: "motorista_cpf",
    label: "CPF do motorista",
    mask: "cpf",
  },
  {
    key: "telefone_coleta",
    label: "Celular do motorista",
    mask: "phone",
  },
  {
    key: "data_coleta_prevista",
    label: "Data agendada da coleta",
    type: "date",
  },
];

export const camposFormularioPorTipo = (tipo) =>
  tipo === "CANOINHAS"
    ? ORDEM_COLETA_CAMPOS_AUTORIZACAO_COMPACTA
    : ORDEM_COLETA_CAMPOS_PADRAO;

export const buildEmptyDadosVariaveis = () => {
  const all = [
    ...ORDEM_COLETA_CAMPOS_PADRAO,
    ...ORDEM_COLETA_CAMPOS_AUTORIZACAO_COMPACTA,
  ];
  return Object.fromEntries(all.map((f) => [f.key, ""]));
};
