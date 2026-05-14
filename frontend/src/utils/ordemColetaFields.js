/** Campos que alimentam placeholders {{chave}} nos templates HTML do backend. */
export const ORDEM_COLETA_CAMPOS_PADRAO = [
  { key: "numero_pedido", label: "Nº ordem / referência (ex.: 17481 / 6020)" },
  { key: "motorista_cpf", label: "CPF do motorista" },
  { key: "tipo_veiculo", label: "Tipo de veículo (ex.: SIDER / SAIDER)" },
  {
    key: "horario_chegada_coleta",
    label: "Horário chegada na coleta (deixe ____:____ se preencher no local)",
  },
  {
    key: "horario_saida_coleta",
    label: "Horário liberação / saída (deixe ____:____ se preencher no local)",
  },
  { key: "local_coleta", label: "Local / cliente da coleta" },
  { key: "endereco_completo", label: "Endereço completo" },
  { key: "cidade_uf", label: "Cidade / UF" },
  { key: "contato_local", label: "Contato no local" },
  { key: "telefone_coleta", label: "Telefone / celular motorista" },
  { key: "mercadoria", label: "Mercadoria / descrição da carga" },
  { key: "volumes", label: "Volumes" },
  { key: "peso_bruto_estimado", label: "Peso estimado (kg)" },
  { key: "numero_nf", label: "NF / documento" },
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

/** Campos extras do template “autorização compacta” (referência: formulário de um cliente real; personalize o HTML para cada tomador). */
export const ORDEM_COLETA_CAMPOS_AUTORIZACAO_COMPACTA = [
  { key: "razao_social", label: "Tomador — razão social" },
  {
    key: "cliente_endereco_linha1",
    label: "Tomador — endereço (linha 1, ex.: rua e bairro)",
  },
  {
    key: "cliente_endereco_linha2",
    label: "Tomador — cidade / UF / CEP (linha 2)",
  },
  { key: "fornecedor_nome", label: "Fornecedor / local de retirada (nome)" },
  { key: "fornecedor_cnpj", label: "Fornecedor — CNPJ" },
  { key: "fornecedor_endereco", label: "Fornecedor — endereço completo" },
  { key: "numero_autorizacao", label: "Número da autorização (opcional)" },
  { key: "cnpj", label: "CNPJ (campo genérico, se usar em outro trecho)" },
  { key: "validade_ate", label: "Válido até", type: "date" },
  { key: "finalidade_coleta", label: "Finalidade da coleta" },
];

export const buildEmptyDadosVariaveis = () => {
  const all = [
    ...ORDEM_COLETA_CAMPOS_PADRAO,
    ...ORDEM_COLETA_CAMPOS_AUTORIZACAO_COMPACTA,
  ];
  return Object.fromEntries(all.map((f) => [f.key, ""]));
};
