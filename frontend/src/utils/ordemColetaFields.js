/** Campos que alimentam placeholders {{chave}} nos templates HTML do backend. */
export const ORDEM_COLETA_CAMPOS_PADRAO = [
  { key: "numero_pedido", label: "Nº ordem / referência (ex.: 17481 / 6020)" },
  { key: "motorista_cpf", label: "CPF do motorista" },
  { key: "tipo_veiculo", label: "Tipo de veículo (ex.: SIDER / SAIDER)" },
  { key: "local_coleta", label: "Local / cliente da coleta" },
  { key: "endereco_completo", label: "Endereço completo" },
  { key: "cidade_uf", label: "Cidade / UF" },
  { key: "contato_local", label: "Contato no local" },
  { key: "telefone_coleta", label: "Telefone / celular motorista" },
  { key: "mercadoria", label: "Mercadoria / descrição da carga" },
  { key: "data_coleta_prevista", label: "Data prevista da coleta", type: "date" },
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
  },
];

/**
 * Campos do PDF “autorização compacta” (placeholders em autorizacao_coleta_compacta.html).
 * Motorista, placa e carretas vêm do caminhão selecionado.
 */
export const ORDEM_COLETA_CAMPOS_AUTORIZACAO_COMPACTA = [
  { key: "razao_social", label: "Cliente — razão social" },
  {
    key: "cliente_endereco_linha1",
    label: "Cliente — endereço (linha 1, ex.: rua e bairro)",
  },
  {
    key: "cliente_endereco_linha2",
    label: "Cliente — cidade / UF / CEP (linha 2)",
  },
  { key: "fornecedor_nome", label: "Fornecedor / local de retirada" },
  { key: "fornecedor_cnpj", label: "Fornecedor — CNPJ" },
  { key: "fornecedor_endereco", label: "Fornecedor — endereço completo" },
  { key: "motorista_cpf", label: "CPF do motorista" },
  { key: "telefone_coleta", label: "Celular do motorista" },
  { key: "data_coleta_prevista", label: "Data agendada da coleta", type: "date" },
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
