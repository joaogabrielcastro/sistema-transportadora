import { classifyTipoGasto, classifyTipoGastoById } from "./tipoGastoUtils.js";

export const STATUS_PAGAMENTO_OPTIONS = [
  { value: "pago", label: "Pago" },
  { value: "pendente", label: "Pendente" },
  { value: "em_recurso", label: "Em recurso" },
  { value: "cancelado", label: "Cancelado" },
];

export const STATUS_PAGAMENTO_LABEL = Object.fromEntries(
  STATUS_PAGAMENTO_OPTIONS.map((o) => [o.value, o.label]),
);

const UF_OPTIONS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
].map((uf) => ({ value: uf, label: uf }));

const GRAVIDADE_OPTIONS = [
  { value: "leve", label: "Leve" },
  { value: "media", label: "Média" },
  { value: "grave", label: "Grave" },
  { value: "gravissima", label: "Gravíssima" },
];

/** Campos extras por família de gasto. */
const CAMPOS_POR_KIND = {
  multa: [
    {
      name: "numero_ait",
      label: "Nº do auto (AIT)",
      placeholder: "Ex.: E123456789",
      maxLength: 40,
    },
    {
      name: "codigo_infracao",
      label: "Código da infração (CTB)",
      placeholder: "Ex.: 218-I",
      maxLength: 20,
    },
    {
      name: "orgao",
      label: "Órgão autuador",
      placeholder: "PRF, DETRAN, DER, municipal…",
      maxLength: 80,
    },
    {
      name: "local",
      label: "Local da infração",
      placeholder: "Rodovia, km, cidade",
      maxLength: 120,
    },
    {
      name: "uf",
      label: "UF",
      type: "select",
      options: UF_OPTIONS,
    },
    {
      name: "gravidade",
      label: "Gravidade",
      type: "select",
      options: GRAVIDADE_OPTIONS,
    },
    {
      name: "pontos",
      label: "Pontos na CNH",
      type: "number",
      min: 0,
      max: 21,
    },
    {
      name: "data_infracao",
      label: "Data da infração",
      type: "date",
    },
  ],
  pedagio: [
    { name: "praca", label: "Praça / concessionária", maxLength: 120 },
    {
      name: "operador",
      label: "Operador",
      placeholder: "Sem Parar, ConectCar, avulso…",
      maxLength: 80,
    },
    { name: "eixos", label: "Eixos cobrados", type: "number", min: 1, max: 12 },
  ],
  combustivel: [
    { name: "posto", label: "Posto", maxLength: 120 },
    {
      name: "preco_litro",
      label: "Preço / litro (R$)",
      type: "number",
      step: "0.001",
      min: 0,
    },
  ],
  seguro: [
    { name: "seguradora", label: "Seguradora", maxLength: 120 },
    { name: "apolice", label: "Apólice", maxLength: 40 },
    { name: "vigencia_inicio", label: "Vigência início", type: "date" },
    { name: "vigencia_fim", label: "Vigência fim", type: "date" },
  ],
  ipva: [
    {
      name: "exercicio",
      label: "Exercício",
      type: "number",
      min: 2000,
      max: 2100,
      placeholder: "2026",
    },
    { name: "parcela", label: "Parcela", placeholder: "1/3, cota única…", maxLength: 20 },
    { name: "orgao", label: "Órgão / DETRAN", maxLength: 80 },
  ],
  salario: [
    { name: "periodo_inicio", label: "Período início", type: "date" },
    { name: "periodo_fim", label: "Período fim", type: "date" },
  ],
  alimentacao: [
    { name: "local", label: "Estabelecimento", maxLength: 120 },
    { name: "cidade", label: "Cidade", maxLength: 80 },
  ],
  hospedagem: [
    { name: "local", label: "Hotel / pousada", maxLength: 120 },
    { name: "cidade", label: "Cidade", maxLength: 80 },
  ],
  estacionamento: [
    { name: "local", label: "Local", maxLength: 120 },
    { name: "cidade", label: "Cidade", maxLength: 80 },
  ],
  lavagem: [{ name: "local", label: "Lava-rápido / oficina", maxLength: 120 }],
  pecas: [
    { name: "fornecedor", label: "Fornecedor", maxLength: 120 },
    { name: "nota_fiscal", label: "NF-e / cupom", maxLength: 44 },
  ],
  outros: [
    { name: "local", label: "Local / fornecedor", maxLength: 120 },
    { name: "referencia", label: "Referência (NF, OS…)", maxLength: 80 },
  ],
};

export function camposDetalheGasto(kind) {
  return CAMPOS_POR_KIND[kind] || CAMPOS_POR_KIND.outros;
}

export function tituloDetalheGasto(kind) {
  const titulos = {
    multa: "Dados da multa",
    pedagio: "Dados do pedágio",
    combustivel: "Posto e preço",
    seguro: "Apólice e vigência",
    ipva: "IPVA / licenciamento",
    salario: "Período da diária",
    alimentacao: "Local da refeição",
    hospedagem: "Hospedagem",
    estacionamento: "Estacionamento",
    lavagem: "Lavagem",
    pecas: "Peça avulsa",
    outros: "Detalhes do gasto",
  };
  return titulos[kind] || titulos.outros;
}

export function detalhesFromRaw(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null || v === "") continue;
    out[k] = String(v);
  }
  return out;
}

/** Monta o JSON enviado à API; vazio vira null. */
export function compactDetalhes(detalhes) {
  if (!detalhes || typeof detalhes !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(detalhes)) {
    if (v == null) continue;
    const text = String(v).trim();
    if (!text) continue;
    out[k] = text;
  }
  return Object.keys(out).length ? out : null;
}

export function defaultStatusForKind(kind) {
  return kind === "multa" || kind === "ipva" || kind === "seguro"
    ? "pendente"
    : "pago";
}

export { classifyTipoGasto, classifyTipoGastoById };
