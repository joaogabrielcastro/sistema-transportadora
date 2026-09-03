import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  Button,
  Card,
  FormField,
  Modal,
  SearchableSelect,
} from "../ui";
import { useApiMutation } from "../../hooks";
import { parseApiError } from "../../lib/apiClient.js";
import { formatCaminhaoOptions } from "../../utils/caminhaoOptions.js";
import {
  CpfCnpjField,
  MoneyField,
  PercentField,
  UfField,
} from "./FiscalFields.jsx";
import {
  WEIGHT_CEILING_14_3,
  QTY_CEILING_15_4,
  semDigitos,
  emailBasicoValido,
} from "../../utils/fiscalFieldMask.js";
import {
  chave44Valida,
  documentoInfDocValido,
  empresaFiscalSemCrt,
  exigeGrupoIbsCbs,
  mostrarDifalCte,
  somenteDigitos,
  tiposDocumentoConflitantes,
} from "../../utils/fiscalForms.js";

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const emptyForm = {
  cliente_id: "",
  caminhao_id: "",
  cfop: "",
  natureza_operacao: "",
  dt_emissao: nowLocalInput(),
  valor_prestacao: "",
  valor_carga: "",
  peso: "",
  produto_predominante: "",
  outras_caracteristicas: "",
  chave_nfe_referenciada: "",
  rntrc: "",
  // Grupo imp.ICMS (item 1.1)
  icms_cst: "",
  icms_base: "",
  icms_aliquota: "",
  icms_valor: "",
  icms_reducao_base: "",
  // Grupo imp.IBSCBS (item 1.1) — só usado quando a empresa emitente é Regime
  // Normal (CRT 3); os campos ficam no form mas a seção só aparece nesse caso.
  ibscbs_cst: "",
  ibscbs_c_class_trib: "",
  ibscbs_base: "",
  ibscbs_ibs_uf_valor: "",
  ibscbs_ibs_mun_valor: "",
  ibscbs_cbs_valor: "",
  ibscbs_valor_total: "",
  ibscbs_ibs_uf_aliquota: "",
  ibscbs_ibs_mun_aliquota: "",
  ibscbs_cbs_aliquota: "",
  ibscbs_percentual_reducao_ibs: "",
  ibscbs_percentual_reducao_cbs: "",
  ibscbs_percentual_diferimento: "",
  // Operação / ICMSUFFim — DIFAL (PARTE 4.3)
  uf_ini: "",
  uf_fim: "",
  tomador_ind_ie: "",
  difal_vbc_uf_fim: "",
  difal_p_fcp_uf_fim: "",
  difal_p_icms_uf_fim: "",
  difal_p_icms_inter: "",
  difal_v_fcp_uf_fim: "",
  difal_v_icms_uf_fim: "",
  difal_v_icms_uf_ini: "",
  // Grupo Imposto.TributosFederal (PARTE 4.4)
  trib_pis_valor: "",
  trib_cofins_valor: "",
  trib_ir_valor: "",
  trib_inss_valor: "",
  trib_csll_valor: "",
};

const TIPO_DOC_OPTIONS = [
  { value: "nfe", label: "NF-e (chave de 44 dígitos)" },
  { value: "nf", label: "NF em papel (modelo 01/1B)" },
];

const TOMADOR_IND_IE_OPTIONS = [
  { value: "1", label: "1 — Contribuinte de ICMS" },
  { value: "2", label: "2 — Contribuinte isento de inscrição" },
  { value: "9", label: "9 — Não contribuinte" },
];

const novoDocumento = () => ({
  tipo: "nfe",
  chave: "",
  numero: "",
  serie: "",
  data_emissao: "",
  valor: "",
});

const novaQuantidade = () => ({
  codigo_unidade: "",
  tipo_medida: "",
  quantidade: "",
});

const novoComponente = () => ({ nome: "", valor: "" });

// Participante do CT-e (rem / dest / exped / toma) — contato + endereço
// completos (item 1.2 / 0.7). A chave interna do documento é sempre `cnpj_cpf`;
// no payload o Tomador usa `cpf_cnpj` (ligado ao cliente) e os demais `cnpj_cpf`.
const novoParticipante = () => ({
  cnpj_cpf: "",
  ie: "",
  razao_social: "",
  nome_fantasia: "",
  fone: "",
  email: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  codigo_municipio: "",
  nome_municipio: "",
  uf: "",
  cep: "",
});

const CONTATO_KEYS = ["ie", "razao_social", "nome_fantasia", "fone", "email"];
const ENDERECO_KEYS = [
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "codigo_municipio",
  "nome_municipio",
  "uf",
  "cep",
];

const num = (v) => {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Monta { contato..., endereco? } de um participante; devolve null se vazio. */
function montarParticipantePayload(p) {
  const out = {};
  for (const k of CONTATO_KEYS) {
    const v = String(p[k] ?? "").trim();
    if (v) out[k] = v;
  }
  const endereco = {};
  for (const k of ENDERECO_KEYS) {
    const raw = String(p[k] ?? "").trim();
    if (!raw) continue;
    endereco[k] = k === "uf" ? raw.toUpperCase() : raw;
  }
  if (Object.keys(endereco).length) out.endereco = endereco;
  return Object.keys(out).length ? out : null;
}

/**
 * Campos de contato + endereço de um participante do CT-e. `docLabel`/`docValue`
 * controlam o campo de documento: o Tomador recebe o CNPJ/CPF do cliente
 * vinculado em modo leitura; os demais deixam editar.
 */
function ParticipanteFields({
  value,
  onChange,
  docReadOnly = false,
  docHint,
  tomador = false,
}) {
  const set = (campo, v) => onChange({ ...value, [campo]: v });
  // Travas de campo do Tomador do serviço (rodada 2). Só valem para a seção do
  // Tomador — Remetente / Destinatário / Expedidor seguem com o comportamento
  // antigo (o componente é compartilhado).
  const soDigitos = (v, n) => v.replace(/\D/g, "").slice(0, n);
  const emailInvalido = tomador && !emailBasicoValido(value.email);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <CpfCnpjField
          label="CNPJ / CPF"
          value={value.cnpj_cpf}
          onChange={(e) => set("cnpj_cpf", e.target.value)}
          placeholder="Somente números"
          readOnly={docReadOnly}
          disabled={docReadOnly}
          helperText={docHint}
          className="mb-0"
        />
        <FormField
          label="Inscrição estadual"
          value={value.ie}
          onChange={(e) =>
            set("ie", tomador ? soDigitos(e.target.value, 20) : e.target.value)
          }
          inputMode={tomador ? "numeric" : undefined}
          placeholder={tomador ? "Somente números" : undefined}
          maxLength={20}
          className="mb-0"
        />
        <FormField
          label="Razão social / nome"
          value={value.razao_social}
          onChange={(e) =>
            set(
              "razao_social",
              tomador ? semDigitos(e.target.value) : e.target.value,
            )
          }
          maxLength={255}
          className="mb-0"
        />
        <FormField
          label="Nome fantasia"
          value={value.nome_fantasia}
          onChange={(e) =>
            set(
              "nome_fantasia",
              tomador ? semDigitos(e.target.value) : e.target.value,
            )
          }
          maxLength={255}
          className="mb-0"
        />
        <FormField
          label="Telefone"
          value={value.fone}
          onChange={(e) =>
            set(
              "fone",
              tomador
                ? soDigitos(e.target.value, 11)
                : e.target.value.replace(/\D/g, ""),
            )
          }
          placeholder={tomador ? "DDD + número (11 dígitos)" : "Somente números"}
          inputMode="numeric"
          maxLength={tomador ? 11 : 20}
          className="mb-0"
        />
        <FormField
          label="E-mail"
          type="email"
          value={value.email}
          onChange={(e) => set("email", e.target.value)}
          maxLength={120}
          error={emailInvalido ? "E-mail em formato inválido." : undefined}
          className="mb-0"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <FormField
          label="Logradouro"
          value={value.logradouro}
          onChange={(e) => set("logradouro", e.target.value)}
          maxLength={tomador ? 60 : 255}
          className="mb-0 md:col-span-2"
        />
        <FormField
          label="Número"
          value={value.numero}
          onChange={(e) => set("numero", e.target.value)}
          maxLength={tomador ? 10 : 60}
          className="mb-0"
        />
        <FormField
          label="Complemento"
          value={value.complemento}
          onChange={(e) => set("complemento", e.target.value)}
          maxLength={tomador ? 60 : 255}
          className="mb-0"
        />
        <FormField
          label="Bairro"
          value={value.bairro}
          onChange={(e) => set("bairro", e.target.value)}
          maxLength={tomador ? 60 : 120}
          className="mb-0"
        />
        <FormField
          label="CEP"
          value={value.cep}
          onChange={(e) =>
            set("cep", e.target.value.replace(/\D/g, "").slice(0, 8))
          }
          placeholder="8 dígitos"
          maxLength={8}
          className="mb-0"
        />
        <FormField
          label="Código IBGE do município"
          value={value.codigo_municipio}
          onChange={(e) =>
            set(
              "codigo_municipio",
              e.target.value.replace(/\D/g, "").slice(0, 7),
            )
          }
          placeholder="7 dígitos"
          maxLength={7}
          className="mb-0"
        />
        <FormField
          label="Município"
          value={value.nome_municipio}
          onChange={(e) =>
            set(
              "nome_municipio",
              tomador ? semDigitos(e.target.value) : e.target.value,
            )
          }
          maxLength={tomador ? 60 : 120}
          className="mb-0"
        />
        <UfField
          label="UF"
          value={value.uf}
          onChange={(e) => set("uf", e.target.value)}
          className="mb-0"
        />
      </div>
    </div>
  );
}

ParticipanteFields.propTypes = {
  value: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  docReadOnly: PropTypes.bool,
  docHint: PropTypes.string,
  /** Aplica as travas de campo do Tomador do serviço (só números / só letras
   *  / limites SEFAZ). Só a seção do Tomador passa isso. */
  tomador: PropTypes.bool,
};

/**
 * Formulário de emissão de CT-e Normal (tipo "0"). Complemento de Valores (1) e
 * Substituto (3) têm formulários próprios na aba "Emitidos" (CteReferenciaModal).
 * `fiscal_empresa_id` não é pedido: o backend resolve a única empresa fiscal
 * ativa do tenant.
 *
 * `empresaFiscal` (somente leitura, vinda de GET /fiscal/empresas) é usada
 * apenas para ler o `crt` da empresa emissora: decidir se o grupo IBS/CBS
 * aparece (item 1.1) e bloquear a emissão, com mensagem clara, quando não há
 * CRT cadastrado. Não há edição de empresa fiscal aqui — é outra área do
 * sistema.
 */
export default function CteForm({
  clientes = [],
  caminhoes = [],
  submitting = false,
  onSubmit,
  empresaFiscal = null,
  empresaFiscalCarregada = false,
}) {
  const { post } = useApiMutation();
  const [form, setForm] = useState(emptyForm);
  const [documentos, setDocumentos] = useState([novoDocumento()]);
  const [quantidades, setQuantidades] = useState([novaQuantidade()]);
  const [componentes, setComponentes] = useState([]);
  const [tomadorExtra, setTomadorExtra] = useState(novoParticipante());
  const [remetente, setRemetente] = useState(novoParticipante());
  const [destinatario, setDestinatario] = useState(novoParticipante());
  const [expedidor, setExpedidor] = useState(novoParticipante());
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [novoCliente, setNovoCliente] = useState({
    razao_social: "",
    cnpj_cpf: "",
  });
  const [criandoCliente, setCriandoCliente] = useState(false);
  const [erroCliente, setErroCliente] = useState("");

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const setDocumento = (idx, campo, valor) =>
    setDocumentos((docs) =>
      docs.map((d, i) => (i === idx ? { ...d, [campo]: valor } : d)),
    );
  const addDocumento = () =>
    setDocumentos((docs) => [...docs, novoDocumento()]);
  const removeDocumento = (idx) =>
    setDocumentos((docs) =>
      docs.length === 1 ? docs : docs.filter((_, i) => i !== idx),
    );

  const setQuantidade = (idx, campo, valor) =>
    setQuantidades((qs) =>
      qs.map((q, i) => (i === idx ? { ...q, [campo]: valor } : q)),
    );
  const addQuantidade = () =>
    setQuantidades((qs) => [...qs, novaQuantidade()]);
  const removeQuantidade = (idx) =>
    setQuantidades((qs) =>
      qs.length === 1 ? qs : qs.filter((_, i) => i !== idx),
    );

  const setComponente = (idx, campo, valor) =>
    setComponentes((cs) =>
      cs.map((c, i) => (i === idx ? { ...c, [campo]: valor } : c)),
    );
  const addComponente = () =>
    setComponentes((cs) => [...cs, novoComponente()]);
  const removeComponente = (idx) =>
    setComponentes((cs) => cs.filter((_, i) => i !== idx));

  const clienteOptions = useMemo(
    () =>
      clientes.map((c) => ({
        value: String(c.id),
        label: `${c.razao_social} — ${c.cnpj_cpf}`,
        searchText: `${c.razao_social} ${c.cnpj_cpf}`,
      })),
    [clientes],
  );

  const caminhaoOptions = useMemo(
    () => formatCaminhaoOptions(caminhoes),
    [caminhoes],
  );

  const clienteSelecionado = clientes.find(
    (c) => String(c.id) === String(form.cliente_id),
  );

  // --- item 1.1: bloqueio por CRT ausente / visibilidade do grupo IBS/CBS ---
  const bloqueioCrt =
    empresaFiscalCarregada && empresaFiscalSemCrt(empresaFiscal);
  const mostrarIbsCbs = exigeGrupoIbsCbs(
    empresaFiscal?.crt,
    form.dt_emissao || undefined,
  );
  const ibsCbsTemValor = [
    form.ibscbs_base,
    form.ibscbs_ibs_uf_valor,
    form.ibscbs_ibs_mun_valor,
    form.ibscbs_cbs_valor,
    form.ibscbs_valor_total,
  ].some((v) => String(v).trim() !== "");
  const ibsCbsIncompleto =
    mostrarIbsCbs && (!form.ibscbs_cst.trim() || !ibsCbsTemValor);

  // --- item 1.2: documentos vinculados (infDoc) ---
  const chaveLegadaDigits = somenteDigitos(form.chave_nfe_referenciada);
  const chaveLegadaValida =
    chaveLegadaDigits.length > 0 && chave44Valida(chaveLegadaDigits);
  const chaveLegadaInvalida =
    chaveLegadaDigits.length > 0 && !chaveLegadaValida;
  const documentosValidos = documentos.filter(documentoInfDocValido);
  const totalDocumentos =
    documentosValidos.length + (chaveLegadaValida ? 1 : 0);
  const tiposInformados = [
    ...(chaveLegadaValida ? ["nfe"] : []),
    ...documentos
      .filter((d) => documentoInfDocValido(d))
      .map((d) => d.tipo),
  ];
  const documentosConflitam = tiposDocumentoConflitantes(tiposInformados);
  // Uma chave 'nfe' digitada mas ainda inválida também não pode conviver com 'nf'.
  const algumNfPreenchido = documentos.some(
    (d) => d.tipo === "nf" && String(d.numero ?? "").trim() !== "",
  );
  const algumNfePreenchido =
    chaveLegadaDigits.length > 0 ||
    documentos.some(
      (d) => d.tipo === "nfe" && String(d.chave ?? "").trim() !== "",
    );
  const misturaTipos = algumNfPreenchido && algumNfePreenchido;

  // --- item 1.3: quantidades (infQ) ---
  const quantidadesValidas = quantidades.filter(
    (q) => num(q.quantidade) != null && Number(q.quantidade) > 0,
  );

  // --- PARTE 4.1: componentes do frete ---
  const componentesValidos = componentes.filter(
    (c) => String(c.nome ?? "").trim().length > 0,
  );

  // --- PARTE 4.3: ICMSUFFim / DIFAL ---
  const tomadorDoc = clienteSelecionado?.cnpj_cpf ?? "";
  const mostrarDifal = mostrarDifalCte({
    ufIni: form.uf_ini,
    ufFim: form.uf_fim,
    tomadorIndIe: form.tomador_ind_ie,
    tomadorDoc,
    remetenteDoc: remetente.cnpj_cpf,
  });
  const difalCampos = [
    form.difal_vbc_uf_fim,
    form.difal_p_fcp_uf_fim,
    form.difal_p_icms_uf_fim,
    form.difal_p_icms_inter,
    form.difal_v_fcp_uf_fim,
    form.difal_v_icms_uf_fim,
    form.difal_v_icms_uf_ini,
  ];
  const difalTemValor = difalCampos.some((v) => String(v).trim() !== "");
  const difalIncompleto = mostrarDifal && !difalTemValor;

  const handleCriarCliente = async () => {
    setErroCliente("");
    if (
      novoCliente.razao_social.trim().length < 2 ||
      novoCliente.cnpj_cpf.replace(/\D/g, "").length < 11
    ) {
      setErroCliente("Informe razão social e um CNPJ/CPF válido.");
      return;
    }
    setCriandoCliente(true);
    try {
      const res = await post(
        "/fiscal/clientes",
        {
          razao_social: novoCliente.razao_social.trim(),
          cnpj_cpf: novoCliente.cnpj_cpf.replace(/\D/g, ""),
        },
        { skipSuccessToast: true, skipErrorToast: true },
      );
      const criado = res?.data;
      if (criado?.id) set("cliente_id", String(criado.id));
      setNovoCliente({ razao_social: "", cnpj_cpf: "" });
      setNovoClienteOpen(false);
    } catch (err) {
      const parsed = await parseApiError(err);
      setErroCliente(parsed.message || "Falha ao cadastrar cliente");
    } finally {
      setCriandoCliente(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!clienteSelecionado) return;

    const carga = {};
    if (num(form.valor_carga) != null) carga.valor_carga = num(form.valor_carga);
    if (num(form.peso) != null) carga.peso = num(form.peso);
    if (form.produto_predominante.trim())
      carga.produto_predominante = form.produto_predominante.trim();
    if (form.outras_caracteristicas.trim())
      carga.outras_caracteristicas = form.outras_caracteristicas.trim();

    const quantidadesPayload = quantidades
      .map((q) => {
        const linha = {};
        if (q.codigo_unidade.trim())
          linha.codigo_unidade = q.codigo_unidade.trim();
        if (q.tipo_medida.trim()) linha.tipo_medida = q.tipo_medida.trim();
        if (num(q.quantidade) != null) linha.quantidade = num(q.quantidade);
        return linha;
      })
      .filter((linha) => Object.keys(linha).length > 0);
    if (quantidadesPayload.length) carga.quantidades = quantidadesPayload;

    // Grupo vPrest — valor_prestacao + componentes livres { nome, valor } (4.1).
    const servico = { valor_prestacao: num(form.valor_prestacao) ?? 0 };
    const componentesPayload = componentes
      .map((c) => {
        const nome = String(c.nome ?? "").trim();
        if (!nome) return null;
        const linha = { nome };
        if (num(c.valor) != null) linha.valor = num(c.valor);
        return linha;
      })
      .filter(Boolean);
    if (componentesPayload.length) servico.componentes = componentesPayload;

    const payload = {
      cliente_id: Number(form.cliente_id),
      caminhao_id: form.caminhao_id ? Number(form.caminhao_id) : null,
      tipo_cte: "0",
      cfop: form.cfop.trim(),
      natureza_operacao: form.natureza_operacao.trim(),
      dt_emissao: new Date(form.dt_emissao).toISOString(),
      servico,
      tomador: {
        cpf_cnpj: clienteSelecionado.cnpj_cpf,
        ...(montarParticipantePayload(tomadorExtra) ?? {}),
      },
    };
    if (Object.keys(carga).length) payload.carga = carga;

    // Participantes tipados (rem / dest / exped) — item 1.2 / PARTE 4.2. O fluxo
    // de `cliente_id` continua sendo a fonte do tomador; estas seções são
    // opcionais e só entram no payload quando têm algum campo preenchido.
    for (const [chave, estado] of [
      ["remetente", remetente],
      ["destinatario", destinatario],
      ["expedidor", expedidor],
    ]) {
      const corpo = montarParticipantePayload(estado);
      const doc = somenteDigitos(estado.cnpj_cpf);
      if (!corpo && !doc) continue;
      payload[chave] = { ...(corpo ?? {}) };
      if (doc) payload[chave].cnpj_cpf = doc;
    }

    // Grupo imp.ICMS (item 1.1)
    const icms = {};
    if (form.icms_cst.trim()) icms.cst = form.icms_cst.trim();
    if (num(form.icms_base) != null) icms.base = num(form.icms_base);
    if (num(form.icms_aliquota) != null)
      icms.aliquota = num(form.icms_aliquota);
    if (num(form.icms_valor) != null) icms.valor = num(form.icms_valor);
    if (num(form.icms_reducao_base) != null)
      icms.reducao_base = num(form.icms_reducao_base);
    if (Object.keys(icms).length) payload.icms = icms;

    // Grupo imp.IBSCBS (item 1.1) — só quando a seção está visível.
    if (mostrarIbsCbs) {
      const ibscbs = {};
      if (form.ibscbs_cst.trim()) ibscbs.cst = form.ibscbs_cst.trim();
      if (form.ibscbs_c_class_trib.trim())
        ibscbs.c_class_trib = form.ibscbs_c_class_trib.trim();
      if (num(form.ibscbs_base) != null) ibscbs.base = num(form.ibscbs_base);
      if (num(form.ibscbs_ibs_uf_valor) != null)
        ibscbs.ibs_uf_valor = num(form.ibscbs_ibs_uf_valor);
      if (num(form.ibscbs_ibs_mun_valor) != null)
        ibscbs.ibs_mun_valor = num(form.ibscbs_ibs_mun_valor);
      if (num(form.ibscbs_cbs_valor) != null)
        ibscbs.cbs_valor = num(form.ibscbs_cbs_valor);
      if (num(form.ibscbs_valor_total) != null)
        ibscbs.valor_total = num(form.ibscbs_valor_total);
      if (num(form.ibscbs_ibs_uf_aliquota) != null)
        ibscbs.ibs_uf_aliquota = num(form.ibscbs_ibs_uf_aliquota);
      if (num(form.ibscbs_ibs_mun_aliquota) != null)
        ibscbs.ibs_mun_aliquota = num(form.ibscbs_ibs_mun_aliquota);
      if (num(form.ibscbs_cbs_aliquota) != null)
        ibscbs.cbs_aliquota = num(form.ibscbs_cbs_aliquota);
      if (num(form.ibscbs_percentual_reducao_ibs) != null)
        ibscbs.percentual_reducao_ibs = num(form.ibscbs_percentual_reducao_ibs);
      if (num(form.ibscbs_percentual_reducao_cbs) != null)
        ibscbs.percentual_reducao_cbs = num(form.ibscbs_percentual_reducao_cbs);
      if (num(form.ibscbs_percentual_diferimento) != null)
        ibscbs.percentual_diferimento = num(
          form.ibscbs_percentual_diferimento,
        );
      if (Object.keys(ibscbs).length) payload.ibscbs = ibscbs;
    }

    // Operação interestadual / ICMSUFFim — DIFAL (PARTE 4.3).
    if (form.uf_ini.trim()) payload.uf_ini = form.uf_ini.trim().toUpperCase();
    if (form.uf_fim.trim()) payload.uf_fim = form.uf_fim.trim().toUpperCase();
    if (form.tomador_ind_ie)
      payload.tomador_ind_ie = Number(form.tomador_ind_ie);
    if (mostrarDifal) {
      const difal = {};
      const map = [
        ["vbc_uf_fim", form.difal_vbc_uf_fim],
        ["p_fcp_uf_fim", form.difal_p_fcp_uf_fim],
        ["p_icms_uf_fim", form.difal_p_icms_uf_fim],
        ["p_icms_inter", form.difal_p_icms_inter],
        ["v_fcp_uf_fim", form.difal_v_fcp_uf_fim],
        ["v_icms_uf_fim", form.difal_v_icms_uf_fim],
        ["v_icms_uf_ini", form.difal_v_icms_uf_ini],
      ];
      for (const [chave, valor] of map) {
        if (num(valor) != null) difal[chave] = num(valor);
      }
      if (Object.keys(difal).length) payload.difal = difal;
    }

    // Grupo Imposto.TributosFederal (PARTE 4.4) — passthrough puro dos
    // totalizadores PIS/COFINS e IR/INSS/CSLL.
    const tribFed = {};
    for (const [chave, valor] of [
      ["pis_valor", form.trib_pis_valor],
      ["cofins_valor", form.trib_cofins_valor],
      ["ir_valor", form.trib_ir_valor],
      ["inss_valor", form.trib_inss_valor],
      ["csll_valor", form.trib_csll_valor],
    ]) {
      if (num(valor) != null) tribFed[chave] = num(valor);
    }
    if (Object.keys(tribFed).length) payload.trib_fed = tribFed;

    // Grupo infDoc (item 1.2). A chave legada continua indo em
    // `chave_nfe_referenciada` (o backend a conta como 1 documento 'nfe').
    if (chaveLegadaDigits.length) {
      payload.chave_nfe_referenciada = chaveLegadaDigits;
    }
    const documentosPayload = documentosValidos.map((d) => {
      if (d.tipo === "nfe") {
        return { tipo: "nfe", chave: somenteDigitos(d.chave) };
      }
      const linha = { tipo: d.tipo, numero: d.numero.trim() };
      if (d.serie.trim()) linha.serie = d.serie.trim();
      if (d.data_emissao) linha.data_emissao = d.data_emissao;
      if (num(d.valor) != null) linha.valor = num(d.valor);
      return linha;
    });
    if (documentosPayload.length) payload.documentos = documentosPayload;

    if (form.rntrc.trim())
      payload.modal = { rntrc: form.rntrc.replace(/\D/g, "") };

    onSubmit(payload);
  };

  const camposBaseOk =
    form.cliente_id && form.cfop.trim() && form.natureza_operacao.trim();
  const emitirDesabilitado =
    !camposBaseOk ||
    bloqueioCrt ||
    documentosConflitam ||
    misturaTipos ||
    chaveLegadaInvalida ||
    totalDocumentos < 1 ||
    quantidadesValidas.length < 1 ||
    ibsCbsIncompleto ||
    difalIncompleto;

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {bloqueioCrt && (
          <Alert
            type="error"
            message={
              "A empresa fiscal (CNPJ emissor) está sem CRT (Código de Regime " +
              "Tributário) cadastrado. Cadastre o CRT da empresa fiscal antes " +
              "de emitir CT-e — isso é feito na área de cadastro de empresas " +
              "fiscais do sistema."
            }
          />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <SearchableSelect
              label="Cliente / tomador"
              value={form.cliente_id}
              onChange={(v) => set("cliente_id", v)}
              options={clienteOptions}
              placeholder="Busque pela razão social ou CNPJ…"
              required
              className="mb-0"
            />
            <button
              type="button"
              className="mt-1.5 text-xs font-medium text-secondary hover:underline"
              onClick={() => {
                setErroCliente("");
                setNovoClienteOpen(true);
              }}
            >
              + novo cliente
            </button>
          </div>

          <SearchableSelect
            label="Caminhão (opcional)"
            value={form.caminhao_id}
            onChange={(v) => set("caminhao_id", v)}
            options={caminhaoOptions}
            placeholder="Placa do veículo…"
            allowEmpty
            emptyLabel="Sem caminhão"
            className="mb-0"
          />

          <FormField
            label="CFOP"
            value={form.cfop}
            onChange={(e) =>
              set("cfop", e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="5353"
            inputMode="numeric"
            maxLength={4}
            required
            className="mb-0"
          />

          <FormField
            label="Natureza da operação"
            value={form.natureza_operacao}
            onChange={(e) => set("natureza_operacao", e.target.value)}
            placeholder="Prestação de serviço de transporte"
            maxLength={60}
            required
            className="mb-0"
          />

          <FormField
            label="Data/hora de emissão"
            type="datetime-local"
            value={form.dt_emissao}
            onChange={(e) => set("dt_emissao", e.target.value)}
            required
            className="mb-0"
          />

          <MoneyField
            label="Valor da prestação (serviço)"
            value={form.valor_prestacao}
            onChange={(e) => set("valor_prestacao", e.target.value)}
            placeholder="0,00"
            className="mb-0"
          />

          <FormField
            label="RNTRC (modal rodoviário)"
            value={form.rntrc}
            onChange={(e) =>
              set("rntrc", e.target.value.replace(/\D/g, "").slice(0, 8))
            }
            placeholder="8 dígitos"
            inputMode="numeric"
            maxLength={8}
            helperText="Exatamente 8 dígitos."
            className="mb-0"
          />
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PARTE 4.1 — Componentes do frete (vPrest.Comp) */}
        {/* ------------------------------------------------------------------ */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Componentes do frete (Comp)
              </p>
              <p className="text-xs text-text-secondary">
                Lista livre de componentes do valor da prestação (frete peso,
                pedágio, ADEME…). Opcional — a soma não é conferida aqui.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addComponente}
            >
              + adicionar
            </Button>
          </div>
          {componentes.length === 0 ? (
            <p className="text-xs text-text-secondary">
              Nenhum componente informado.
            </p>
          ) : (
            componentes.map((c, idx) => (
              <div
                key={idx}
                className="grid gap-2 md:grid-cols-[2fr_1fr_auto] md:items-end"
              >
                <FormField
                  label="Nome"
                  value={c.nome}
                  onChange={(e) => setComponente(idx, "nome", e.target.value)}
                  placeholder="Ex.: Frete peso"
                  maxLength={60}
                  className="mb-0"
                />
                <MoneyField
                  label="Valor"
                  value={c.valor}
                  onChange={(e) => setComponente(idx, "valor", e.target.value)}
                  placeholder="0,00"
                  className="mb-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeComponente(idx)}
                >
                  remover
                </Button>
              </div>
            ))
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PARTE 4.2 — Participantes (Tomador, Remetente, Destinatário, Expedidor) */}
        {/* ------------------------------------------------------------------ */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Participantes</p>
            <p className="text-xs text-text-secondary">
              Quatro seções independentes. O Tomador segue vindo do cliente
              vinculado acima; os demais são opcionais — preencha só os que se
              aplicam. Cada seção tem endereço e contato completos.
            </p>
          </div>

          <details className="rounded border border-border" open>
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text-primary">
              Tomador do serviço
            </summary>
            <div className="border-t border-border p-3">
              <ParticipanteFields
                value={{
                  ...tomadorExtra,
                  cnpj_cpf: tomadorDoc || tomadorExtra.cnpj_cpf,
                }}
                onChange={setTomadorExtra}
                docReadOnly
                docHint="Vem do cliente vinculado — não editável aqui."
                tomador
              />
            </div>
          </details>

          <details className="rounded border border-border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text-primary">
              Remetente
            </summary>
            <div className="border-t border-border p-3">
              <ParticipanteFields value={remetente} onChange={setRemetente} />
            </div>
          </details>

          <details className="rounded border border-border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text-primary">
              Destinatário
            </summary>
            <div className="border-t border-border p-3">
              <ParticipanteFields
                value={destinatario}
                onChange={setDestinatario}
              />
            </div>
          </details>

          <details className="rounded border border-border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text-primary">
              Expedidor
            </summary>
            <div className="border-t border-border p-3">
              <ParticipanteFields value={expedidor} onChange={setExpedidor} />
            </div>
          </details>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Item 1.3 — infCarga */}
        {/* ------------------------------------------------------------------ */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <p className="text-sm font-medium text-text-primary">
            Carga (infCarga)
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <MoneyField
              label="Valor da carga"
              value={form.valor_carga}
              onChange={(e) => set("valor_carga", e.target.value)}
              placeholder="0,00"
              className="mb-0"
            />
            <FormField
              label="Peso da carga (kg)"
              type="number"
              step="0.001"
              min={0}
              max={WEIGHT_CEILING_14_3}
              useGrouping={false}
              value={form.peso}
              onChange={(e) => set("peso", e.target.value)}
              placeholder="0"
              className="mb-0"
            />
            <FormField
              label="Produto predominante"
              value={form.produto_predominante}
              onChange={(e) => set("produto_predominante", e.target.value)}
              placeholder="Ex.: Soja a granel"
              maxLength={60}
              className="mb-0"
            />
            <FormField
              label="Outras características"
              value={form.outras_caracteristicas}
              onChange={(e) =>
                set("outras_caracteristicas", e.target.value)
              }
              placeholder="Ex.: Granel sólido"
              maxLength={30}
              className="mb-0"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-primary">
                Quantidades da carga (infQ)
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addQuantidade}
              >
                + adicionar
              </Button>
            </div>
            {quantidadesValidas.length < 1 && (
              <p className="text-xs text-danger">
                Informe ao menos uma quantidade com valor maior que zero.
              </p>
            )}
            {quantidades.map((q, idx) => (
              <div
                key={idx}
                className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
              >
                <FormField
                  label="Cód. unidade"
                  value={q.codigo_unidade}
                  onChange={(e) =>
                    setQuantidade(
                      idx,
                      "codigo_unidade",
                      e.target.value.slice(0, 2),
                    )
                  }
                  placeholder="Ex.: 01"
                  maxLength={2}
                  className="mb-0"
                />
                <FormField
                  label="Tipo de medida"
                  value={q.tipo_medida}
                  onChange={(e) =>
                    setQuantidade(idx, "tipo_medida", e.target.value)
                  }
                  placeholder="Ex.: PESO BRUTO"
                  maxLength={20}
                  className="mb-0"
                />
                <FormField
                  label="Quantidade"
                  type="number"
                  step="0.0001"
                  min={0}
                  max={QTY_CEILING_15_4}
                  useGrouping={false}
                  value={q.quantidade}
                  onChange={(e) =>
                    setQuantidade(idx, "quantidade", e.target.value)
                  }
                  placeholder="0"
                  className="mb-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeQuantidade(idx)}
                  disabled={quantidades.length === 1}
                >
                  remover
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Item 1.2 — infDoc (documentos vinculados) */}
        {/* ------------------------------------------------------------------ */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Documentos vinculados (infDoc)
              </p>
              <p className="text-xs text-text-secondary">
                Ao menos um documento é obrigatório. NF-e e NF em papel não
                podem ser misturadas no mesmo CT-e.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDocumento}
            >
              + adicionar
            </Button>
          </div>

          <FormField
            label="Chave da NF-e referenciada (opcional)"
            value={form.chave_nfe_referenciada}
            onChange={(e) => set("chave_nfe_referenciada", e.target.value)}
            placeholder="44 dígitos da NF-e transportada"
            maxLength={54}
            error={
              chaveLegadaInvalida
                ? "Chave inválida (deve ter 44 dígitos e dígito verificador válido)."
                : undefined
            }
            helperText="Campo legado — conta como um documento NF-e."
            className="mb-0"
          />

          {(documentosConflitam || misturaTipos) && (
            <Alert
              type="error"
              message="Não misture documentos NF-e e NF em papel no mesmo CT-e."
            />
          )}
          {totalDocumentos < 1 && !documentosConflitam && (
            <p className="text-xs text-danger">
              Informe ao menos um documento transportado.
            </p>
          )}

          {documentos.map((d, idx) => {
            const chaveInvalida =
              d.tipo === "nfe" &&
              String(d.chave ?? "").trim() !== "" &&
              !chave44Valida(d.chave);
            return (
              <div
                key={idx}
                className="rounded border border-border p-3 space-y-2"
              >
                <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                  <FormField
                    label={`Documento ${idx + 1}`}
                    type="select"
                    value={d.tipo}
                    onChange={(e) => setDocumento(idx, "tipo", e.target.value)}
                    options={TIPO_DOC_OPTIONS}
                    className="mb-0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDocumento(idx)}
                    disabled={documentos.length === 1}
                  >
                    remover
                  </Button>
                </div>

                {d.tipo === "nfe" ? (
                  <FormField
                    label="Chave de acesso (44 dígitos)"
                    value={d.chave}
                    onChange={(e) =>
                      setDocumento(idx, "chave", e.target.value)
                    }
                    placeholder="44 dígitos"
                    maxLength={54}
                    error={
                      chaveInvalida
                        ? "Chave inválida (44 dígitos + dígito verificador)."
                        : undefined
                    }
                    className="mb-0"
                  />
                ) : (
                  <div className="grid gap-2 md:grid-cols-4">
                    <FormField
                      label="Número"
                      value={d.numero}
                      onChange={(e) =>
                        setDocumento(idx, "numero", e.target.value)
                      }
                      maxLength={20}
                      className="mb-0"
                    />
                    <FormField
                      label="Série"
                      value={d.serie}
                      onChange={(e) =>
                        setDocumento(idx, "serie", e.target.value)
                      }
                      maxLength={10}
                      className="mb-0"
                    />
                    <FormField
                      label="Data de emissão"
                      type="date"
                      value={d.data_emissao}
                      onChange={(e) =>
                        setDocumento(idx, "data_emissao", e.target.value)
                      }
                      className="mb-0"
                    />
                    <FormField
                      label="Valor"
                      type="number"
                      step="0.01"
                      value={d.valor}
                      onChange={(e) =>
                        setDocumento(idx, "valor", e.target.value)
                      }
                      placeholder="0,00"
                      className="mb-0"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Item 1.1 — imp.ICMS */}
        {/* ------------------------------------------------------------------ */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <p className="text-sm font-medium text-text-primary">
            Imposto — ICMS (grupo imp)
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              label="CST"
              value={form.icms_cst}
              onChange={(e) =>
                set("icms_cst", e.target.value.replace(/\D/g, "").slice(0, 3))
              }
              placeholder="Ex.: 00"
              inputMode="numeric"
              maxLength={3}
              className="mb-0"
            />
            <MoneyField
              label="Base de cálculo"
              value={form.icms_base}
              onChange={(e) => set("icms_base", e.target.value)}
              placeholder="0,00"
              className="mb-0"
            />
            <PercentField
              label="Alíquota (%)"
              value={form.icms_aliquota}
              onChange={(e) => set("icms_aliquota", e.target.value)}
              placeholder="0,00"
              className="mb-0"
            />
            <MoneyField
              label="Valor do ICMS"
              value={form.icms_valor}
              onChange={(e) => set("icms_valor", e.target.value)}
              placeholder="0,00"
              className="mb-0"
            />
            <PercentField
              label="Redução da base (%)"
              value={form.icms_reducao_base}
              onChange={(e) => set("icms_reducao_base", e.target.value)}
              placeholder="0,00"
              className="mb-0"
            />
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Item 1.1 — imp.IBSCBS (condicional ao CRT da empresa emitente) */}
        {/* ------------------------------------------------------------------ */}
        {mostrarIbsCbs && (
          <div className="rounded-lg border border-border p-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Imposto — IBS / CBS (grupo imp.IBSCBS)
              </p>
              <p className="text-xs text-text-secondary">
                Exigido para emitente em Regime Normal (CRT 3) desde 05/01/2026.
                Informe o CST, a classificação tributária, a base e as alíquotas
                — o provedor usa esses campos no grupo imp.IBSCBS. Os valores
                calculados ficam só no registro interno.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                label="CST"
                value={form.ibscbs_cst}
                onChange={(e) =>
                  set(
                    "ibscbs_cst",
                    e.target.value.replace(/\D/g, "").slice(0, 3),
                  )
                }
                placeholder="Ex.: 000"
                inputMode="numeric"
                maxLength={3}
                error={
                  ibsCbsIncompleto && !form.ibscbs_cst.trim()
                    ? "Informe o CST do grupo IBS/CBS."
                    : undefined
                }
                className="mb-0"
              />
              <FormField
                label="Classificação tributária"
                value={form.ibscbs_c_class_trib}
                onChange={(e) =>
                  set("ibscbs_c_class_trib", e.target.value.slice(0, 6))
                }
                placeholder="cClassTrib"
                maxLength={6}
                className="mb-0"
              />
              <MoneyField
                label="Base de cálculo"
                value={form.ibscbs_base}
                onChange={(e) => set("ibscbs_base", e.target.value)}
                placeholder="0,00"
                className="mb-0"
              />
              <MoneyField
                label="Valor IBS UF"
                value={form.ibscbs_ibs_uf_valor}
                onChange={(e) =>
                  set("ibscbs_ibs_uf_valor", e.target.value)
                }
                placeholder="0,00"
                className="mb-0"
              />
              <MoneyField
                label="Valor IBS Município"
                value={form.ibscbs_ibs_mun_valor}
                onChange={(e) =>
                  set("ibscbs_ibs_mun_valor", e.target.value)
                }
                placeholder="0,00"
                className="mb-0"
              />
              <MoneyField
                label="Valor CBS"
                value={form.ibscbs_cbs_valor}
                onChange={(e) => set("ibscbs_cbs_valor", e.target.value)}
                placeholder="0,00"
                className="mb-0"
              />
              <MoneyField
                label="Valor total (IBS + CBS)"
                value={form.ibscbs_valor_total}
                onChange={(e) =>
                  set("ibscbs_valor_total", e.target.value)
                }
                placeholder="0,00"
                className="mb-0"
              />
              <PercentField
                label="Alíquota IBS UF (%)"
                value={form.ibscbs_ibs_uf_aliquota}
                onChange={(e) =>
                  set("ibscbs_ibs_uf_aliquota", e.target.value)
                }
                placeholder="0,00"
                className="mb-0"
              />
              <PercentField
                label="Alíquota IBS Município (%)"
                value={form.ibscbs_ibs_mun_aliquota}
                onChange={(e) =>
                  set("ibscbs_ibs_mun_aliquota", e.target.value)
                }
                placeholder="0,00"
                className="mb-0"
              />
              <PercentField
                label="Alíquota CBS (%)"
                value={form.ibscbs_cbs_aliquota}
                onChange={(e) =>
                  set("ibscbs_cbs_aliquota", e.target.value)
                }
                placeholder="0,00"
                className="mb-0"
              />
              <PercentField
                label="Redução IBS (%)"
                value={form.ibscbs_percentual_reducao_ibs}
                onChange={(e) =>
                  set("ibscbs_percentual_reducao_ibs", e.target.value)
                }
                placeholder="0,00"
                className="mb-0"
              />
              <PercentField
                label="Redução CBS (%)"
                value={form.ibscbs_percentual_reducao_cbs}
                onChange={(e) =>
                  set("ibscbs_percentual_reducao_cbs", e.target.value)
                }
                placeholder="0,00"
                className="mb-0"
              />
              <PercentField
                label="Diferimento (%)"
                value={form.ibscbs_percentual_diferimento}
                onChange={(e) =>
                  set("ibscbs_percentual_diferimento", e.target.value)
                }
                placeholder="0,00"
                className="mb-0"
              />
            </div>
            {ibsCbsIncompleto && form.ibscbs_cst.trim() && (
              <p className="text-xs text-danger">
                Informe ao menos um valor de IBS/CBS.
              </p>
            )}
            <p className="text-xs text-text-secondary">
              Valores calculados (IBS UF, IBS Município, CBS e total) ficam
              gravados para consulta. O provedor recebe classificação, base,
              alíquotas e percentuais de redução/diferimento.
            </p>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* PARTE 4.3 — Operação interestadual / ICMSUFFim (DIFAL) */}
        {/* ------------------------------------------------------------------ */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-text-primary">
              Operação — UF de início/fim e indicador do tomador
            </p>
            <p className="text-xs text-text-secondary">
              O grupo ICMSUFFim (partilha do ICMS / DIFAL) só é exigido quando a
              operação é interestadual, o tomador é não contribuinte de ICMS e
              difere do remetente.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <UfField
              label="UF de início"
              value={form.uf_ini}
              onChange={(e) => set("uf_ini", e.target.value)}
              placeholder="SP"
              className="mb-0"
            />
            <UfField
              label="UF de fim"
              value={form.uf_fim}
              onChange={(e) => set("uf_fim", e.target.value)}
              placeholder="MG"
              className="mb-0"
            />
            <FormField
              label="Indicador de IE do tomador"
              type="select"
              value={form.tomador_ind_ie}
              onChange={(e) => set("tomador_ind_ie", e.target.value)}
              options={TOMADOR_IND_IE_OPTIONS}
              allowEmpty
              emptyLabel="Não informar"
              className="mb-0"
            />
          </div>

          {mostrarDifal && (
            <div className="space-y-3 rounded border border-border p-3">
              <p className="text-sm font-medium text-text-primary">
                ICMSUFFim / DIFAL
              </p>
              {difalIncompleto && (
                <p className="text-xs text-danger">
                  Operação interestadual com tomador não contribuinte e
                  diferente do remetente — informe ao menos um valor do grupo
                  ICMSUFFim.
                </p>
              )}
              <div className="grid gap-4 md:grid-cols-3">
                <MoneyField
                  label="Base de cálculo UF fim"
                  value={form.difal_vbc_uf_fim}
                  onChange={(e) => set("difal_vbc_uf_fim", e.target.value)}
                  placeholder="0,00"
                  className="mb-0"
                />
                <PercentField
                  label="% FCP UF fim"
                  value={form.difal_p_fcp_uf_fim}
                  onChange={(e) => set("difal_p_fcp_uf_fim", e.target.value)}
                  placeholder="0,00"
                  className="mb-0"
                />
                <PercentField
                  label="% ICMS UF fim"
                  value={form.difal_p_icms_uf_fim}
                  onChange={(e) => set("difal_p_icms_uf_fim", e.target.value)}
                  placeholder="0,00"
                  className="mb-0"
                />
                <PercentField
                  label="% ICMS interestadual"
                  value={form.difal_p_icms_inter}
                  onChange={(e) => set("difal_p_icms_inter", e.target.value)}
                  placeholder="0,00"
                  className="mb-0"
                />
                <MoneyField
                  label="Valor FCP UF fim"
                  value={form.difal_v_fcp_uf_fim}
                  onChange={(e) => set("difal_v_fcp_uf_fim", e.target.value)}
                  placeholder="0,00"
                  className="mb-0"
                />
                <MoneyField
                  label="Valor ICMS UF fim"
                  value={form.difal_v_icms_uf_fim}
                  onChange={(e) => set("difal_v_icms_uf_fim", e.target.value)}
                  placeholder="0,00"
                  className="mb-0"
                />
                <MoneyField
                  label="Valor ICMS UF início"
                  value={form.difal_v_icms_uf_ini}
                  onChange={(e) => set("difal_v_icms_uf_ini", e.target.value)}
                  placeholder="0,00"
                  className="mb-0"
                />
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PARTE 4.4 — Imposto.TributosFederal */}
        {/* ------------------------------------------------------------------ */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-text-primary">
              Tributos federais (grupo TributosFederal)
            </p>
            <p className="text-xs text-text-secondary">
              Totalizadores informados pelo emissor — nenhum cálculo é feito.
              Todos opcionais.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <MoneyField
              label="Valor do PIS"
              value={form.trib_pis_valor}
              onChange={(e) => set("trib_pis_valor", e.target.value)}
              placeholder="0,00"
              className="mb-0"
            />
            <MoneyField
              label="Valor do COFINS"
              value={form.trib_cofins_valor}
              onChange={(e) => set("trib_cofins_valor", e.target.value)}
              placeholder="0,00"
              className="mb-0"
            />
            <MoneyField
              label="Valor do IR"
              value={form.trib_ir_valor}
              onChange={(e) => set("trib_ir_valor", e.target.value)}
              placeholder="0,00"
              className="mb-0"
            />
            <MoneyField
              label="Valor do INSS"
              value={form.trib_inss_valor}
              onChange={(e) => set("trib_inss_valor", e.target.value)}
              placeholder="0,00"
              className="mb-0"
            />
            <MoneyField
              label="Valor do CSLL"
              value={form.trib_csll_valor}
              onChange={(e) => set("trib_csll_valor", e.target.value)}
              placeholder="0,00"
              className="mb-0"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={submitting} disabled={emitirDesabilitado}>
            Emitir CT-e
          </Button>
        </div>
      </form>

      <Modal
        isOpen={novoClienteOpen}
        onClose={() => setNovoClienteOpen(false)}
        title="Novo cliente / tomador"
        size="sm"
      >
        <div className="space-y-4">
          {erroCliente && <Alert type="error" message={erroCliente} />}
          <FormField
            label="Razão social"
            value={novoCliente.razao_social}
            onChange={(e) =>
              setNovoCliente((c) => ({ ...c, razao_social: e.target.value }))
            }
            required
            className="mb-0"
          />
          <CpfCnpjField
            label="CNPJ / CPF"
            value={novoCliente.cnpj_cpf}
            onChange={(e) =>
              setNovoCliente((c) => ({ ...c, cnpj_cpf: e.target.value }))
            }
            placeholder="Somente números"
            required
            className="mb-0"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNovoClienteOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleCriarCliente}
              loading={criandoCliente}
            >
              Salvar cliente
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

CteForm.propTypes = {
  clientes: PropTypes.array,
  caminhoes: PropTypes.array,
  submitting: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
  /** Empresa fiscal emissora ativa (somente leitura) — usada só para ler o CRT. */
  empresaFiscal: PropTypes.object,
  /** true quando a consulta de empresas fiscais já retornou (sucesso). */
  empresaFiscalCarregada: PropTypes.bool,
};
