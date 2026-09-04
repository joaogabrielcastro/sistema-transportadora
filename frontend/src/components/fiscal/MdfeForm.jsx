import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Button, Card, FormField, SearchableSelect } from "../ui";
import { FiscalFormSteps, FiscalFormStepNav } from "./FiscalFormSteps.jsx";
import { formatCaminhaoOptions } from "../../utils/caminhaoOptions.js";
import { useReboquesPreviewQuery } from "../../hooks";
import { mdfeExigeGruposAntt } from "../../utils/fiscalForms.js";
import { CpfCnpjField, MoneyField, UfField } from "./FiscalFields.jsx";
import {
  WEIGHT_CEILING_14_3,
  semDigitos,
} from "../../utils/fiscalFieldMask.js";

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function isoToLocalMdfe(iso) {
  if (!iso) return nowLocalInput();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return nowLocalInput();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const emptyForm = {
  caminhao_id: "",
  motorista_id: "",
  condutor_nome: "",
  condutor_cpf: "",
  data_emissao: nowLocalInput(),
  uf_carregamento: "",
  uf_descarregamento: "",
  valor: "",
  peso: "",
  percurso_ufs: "",
  // ide (item 2.5)
  tipo_emitente: "",
  ide_modal: "",
  ide_uf_ini: "",
  ide_uf_fim: "",
  ide_dh_ini_viagem: "",
  // infANTT (item 2.2)
  antt_rntrc: "",
  antt_ciot: "",
  antt_vale_pedagio_valor: "",
  // infANTT — infoBancaria / PIX (PARTE 5.5)
  antt_cod_banco: "",
  antt_cod_agencia: "",
  antt_cnpj_inst_pagamento: "",
  antt_pix: "",
  // prodPred (item 2.4 / PARTE 5.6)
  prod_pred_descricao: "",
  prod_pred_ncm: "",
  prod_pred_tp_carga: "",
  prod_pred_c_ean: "",
  prod_pred_lot_carrega_cep: "",
  prod_pred_lot_carrega_lat: "",
  prod_pred_lot_carrega_long: "",
  prod_pred_lot_descarrega_cep: "",
  prod_pred_lot_descarrega_lat: "",
  prod_pred_lot_descarrega_long: "",
};

const RESP_SEG_OPTIONS = [
  { value: "1", label: "1 — Emitente do MDF-e" },
  { value: "2", label: "2 — Contratante do serviço de transporte" },
];

const TIPO_EMITENTE_OPTIONS = [
  { value: "1", label: "1 — Prestador de serviço de transporte" },
  { value: "2", label: "2 — Transporte de carga própria (frota própria)" },
  { value: "3", label: "3 — Prestador de CT-e globalizado" },
];

const MODAL_OPTIONS = [
  { value: "1", label: "1 — Rodoviário" },
  { value: "2", label: "2 — Aéreo" },
  { value: "3", label: "3 — Aquaviário" },
  { value: "4", label: "4 — Ferroviário" },
];

const MDFE_FASES = [
  "Viagem",
  "Documentos",
  "Seguro e ANTT",
  "Produto",
];

// tpCarga do prodPred (SEFAZ). Passthrough no backend — lista só para UX.
const TP_CARGA_OPTIONS = [
  { value: "01", label: "01 — Granel sólido" },
  { value: "02", label: "02 — Granel líquido" },
  { value: "03", label: "03 — Frigorificada" },
  { value: "04", label: "04 — Conteinerizada" },
  { value: "05", label: "05 — Carga geral" },
  { value: "06", label: "06 — Neogranel" },
  { value: "07", label: "07 — Perigosa (granel sólido)" },
  { value: "08", label: "08 — Perigosa (granel líquido)" },
  { value: "09", label: "09 — Perigosa (carga frigorificada)" },
  { value: "10", label: "10 — Perigosa (conteinerizada)" },
  { value: "11", label: "11 — Perigosa (carga geral)" },
];

const novoMunicipio = () => ({ codigo_municipio: "", nome_municipio: "" });

// Seguro da carga como LISTA (PARTE 5.4): cada seguro com 0..N averbações.
const novoSeguro = () => ({
  responsavel: "",
  cnpj_seguradora: "",
  numero_apolice: "",
  nome_seguradora: "",
  averbacoes: [""],
});

const num = (v) => {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Formulário de emissão de MDF-e. Sem campo de `fiscal_empresa_id` — o backend
 * resolve a empresa fiscal ativa do tenant.
 *
 * Os grupos infANTT (2.2), prodPred (2.4) e a checagem de seguro (2.1) só são
 * exigidos na UI quando `tipo_emitente` é 1 ou 3 (prestador de serviço), mesmo
 * critério de `exigeGruposAntt` no MdfeService.
 */
export default function MdfeForm({
  caminhoes = [],
  motoristas = [],
  ctesVinculaveis = [],
  submitting = false,
  savingDraft = false,
  simulating = false,
  onSubmit,
  onSaveDraft,
  onSimular,
  initialPayload = null,
  empresaFiscal = null,
}) {
  const [form, setForm] = useState(emptyForm);
  const [cteIds, setCteIds] = useState([]);
  const [municipiosCarrega, setMunicipiosCarrega] = useState([novoMunicipio()]);
  const [seguros, setSeguros] = useState([novoSeguro()]);
  // infMunDescarga (PARTE 5.1): município de descarga por CT-e selecionado.
  const [descargaPorCte, setDescargaPorCte] = useState({});
  const [fase, setFase] = useState(0);
  const temMotoristas = motoristas.length > 0;

  const toggleCte = (id) =>
    setCteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const [modoCondutor, setModoCondutor] = useState(
    temMotoristas ? "cadastrado" : "manual",
  );

  useEffect(() => {
    if (!temMotoristas) setModoCondutor("manual");
  }, [temMotoristas]);

  useEffect(() => {
    if (!initialPayload || typeof initialPayload !== "object") return;
    const p = initialPayload;
    const condutor = p.rodoviario?.condutores?.[0];
    setForm((f) => ({
      ...f,
      caminhao_id: p.caminhao_id ? String(p.caminhao_id) : "",
      motorista_id: p.motorista_id ? String(p.motorista_id) : "",
      condutor_nome: condutor?.nome || "",
      condutor_cpf: condutor?.cpf || "",
      data_emissao: p.data_emissao
        ? isoToLocalMdfe(p.data_emissao)
        : f.data_emissao,
      uf_carregamento: p.uf_carregamento || "",
      uf_descarregamento: p.uf_descarregamento || "",
      valor: p.valor != null ? String(p.valor) : "",
      peso: p.peso != null ? String(p.peso) : "",
      percurso_ufs: Array.isArray(p.percurso_ufs)
        ? p.percurso_ufs.join(" ")
        : f.percurso_ufs,
      tipo_emitente: p.tipo_emitente != null ? String(p.tipo_emitente) : "",
    }));
    if (Array.isArray(p.cte_ids)) setCteIds(p.cte_ids);
    if (p.motorista_id) setModoCondutor("cadastrado");
    else if (condutor) setModoCondutor("manual");
  }, [initialPayload]);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const setMunicipio = (idx, campo, valor) =>
    setMunicipiosCarrega((ms) =>
      ms.map((m, i) => (i === idx ? { ...m, [campo]: valor } : m)),
    );
  const addMunicipio = () =>
    setMunicipiosCarrega((ms) => [...ms, novoMunicipio()]);
  const removeMunicipio = (idx) =>
    setMunicipiosCarrega((ms) =>
      ms.length === 1 ? ms : ms.filter((_, i) => i !== idx),
    );

  // --- seguros (lista) ---
  const setSeguro = (idx, campo, valor) =>
    setSeguros((ss) =>
      ss.map((s, i) => (i === idx ? { ...s, [campo]: valor } : s)),
    );
  const addSeguro = () => setSeguros((ss) => [...ss, novoSeguro()]);
  const removeSeguro = (idx) =>
    setSeguros((ss) => (ss.length === 1 ? ss : ss.filter((_, i) => i !== idx)));
  const setAverbacao = (si, ai, valor) =>
    setSeguros((ss) =>
      ss.map((s, i) =>
        i === si
          ? {
              ...s,
              averbacoes: s.averbacoes.map((a, j) => (j === ai ? valor : a)),
            }
          : s,
      ),
    );
  const addAverbacao = (si) =>
    setSeguros((ss) =>
      ss.map((s, i) =>
        i === si ? { ...s, averbacoes: [...s.averbacoes, ""] } : s,
      ),
    );
  const removeAverbacao = (si, ai) =>
    setSeguros((ss) =>
      ss.map((s, i) =>
        i === si
          ? {
              ...s,
              averbacoes:
                s.averbacoes.length === 1
                  ? s.averbacoes
                  : s.averbacoes.filter((_, j) => j !== ai),
            }
          : s,
      ),
    );

  const setDescarga = (cteId, campo, valor) =>
    setDescargaPorCte((prev) => ({
      ...prev,
      [cteId]: { ...(prev[cteId] ?? {}), [campo]: valor },
    }));

  const caminhaoOptions = useMemo(
    () => formatCaminhaoOptions(caminhoes),
    [caminhoes],
  );

  const motoristaOptions = useMemo(
    () =>
      motoristas.map((m) => ({
        value: String(m.id),
        label: m.cpf ? `${m.nome} — ${m.cpf}` : `${m.nome} (sem CPF)`,
        searchText: `${m.nome} ${m.cpf || ""}`,
      })),
    [motoristas],
  );

  const ctesSelecionados = useMemo(
    () => ctesVinculaveis.filter((c) => cteIds.includes(c.id)),
    [ctesVinculaveis, cteIds],
  );

  const exigeAntt = mdfeExigeGruposAntt(form.tipo_emitente);
  const anttRntrcDigits = form.antt_rntrc.replace(/\D/g, "");
  const anttPendente = exigeAntt && anttRntrcDigits.length === 0;
  const prodPredPendente = exigeAntt && !form.prod_pred_descricao.trim();
  // NCM do produto: exigido quando o manifesto tem só 1 documento vinculado.
  const ncmRecomendado = cteIds.length === 1;

  // Seguro (PARTE 5.4): pelo menos um seguro precisa de "responsável" definido —
  // é o que satisfaz `assertSeguroMdfe` no backend (seguros[] ou resp_seg).
  const segurosComResponsavel = seguros.filter((s) => s.responsavel !== "");
  const seguroPendente = segurosComResponsavel.length === 0;

  // infMunDescarga (PARTE 5.1): se o usuário associou município a algum CT-e,
  // todos os CT-e selecionados precisam de um. Sem nenhuma associação, o MDF-e
  // segue com a lista plana de vínculos (comportamento atual).
  const descargaPreenchidos = ctesSelecionados.filter((c) =>
    String(descargaPorCte[c.id]?.codigo_municipio ?? "").trim(),
  );
  const usaMunDescarga = descargaPreenchidos.length > 0;
  const descargaParcial =
    usaMunDescarga && descargaPreenchidos.length < ctesSelecionados.length;

  // Data de emissão em ISO para a pré-visualização dos reboques (mesma regra do
  // submit). Vazia/ inválida => usa "agora" no backend.
  const dataEmissaoIso = useMemo(() => {
    const d = new Date(form.data_emissao);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }, [form.data_emissao]);

  const reboquesPreview = useReboquesPreviewQuery({
    caminhaoId: form.caminhao_id || "",
    dataEmissao: dataEmissaoIso,
  });
  const previewData = reboquesPreview.data;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (fase < MDFE_FASES.length - 1) {
      setFase((f) => f + 1);
      return;
    }
    const payload = montarPayload();
    if (payload) onSubmit(payload);
  };

  const handleSaveDraft = () => {
    const payload = montarPayload();
    if (payload) onSaveDraft?.(payload);
  };

  const handleSimular = () => {
    const payload = montarPayload();
    if (payload) onSimular?.(payload);
  };

  const montarPayload = () => {
    // Não descartamos siglas "erradas" em silêncio: mandamos todos os itens não
    // vazios e o backend rejeita com erro claro se algum não for 2 letras.
    const percurso = form.percurso_ufs
      .split(/[,\s]+/)
      .map((uf) => uf.trim().toUpperCase())
      .filter(Boolean);

    const payload = {
      data_emissao: new Date(form.data_emissao).toISOString(),
      uf_carregamento: form.uf_carregamento.trim().toUpperCase(),
      uf_descarregamento: form.uf_descarregamento.trim().toUpperCase(),
      rodoviario: {},
    };
    if (form.caminhao_id) payload.caminhao_id = Number(form.caminhao_id);

    const valor = num(form.valor);
    const peso = num(form.peso);
    if (valor != null) payload.valor = valor;
    if (peso != null) payload.peso = peso;
    if (percurso.length) payload.percurso_ufs = percurso;
    if (cteIds.length) payload.cte_ids = cteIds;

    if (form.tipo_emitente) payload.tipo_emitente = Number(form.tipo_emitente);

    // Seguro da carga como lista (PARTE 5.4).
    const segurosPayload = seguros
      .map((s) => {
        if (s.responsavel === "") return null;
        const linha = { responsavel: Number(s.responsavel) };
        const cnpj = s.cnpj_seguradora.replace(/\D/g, "");
        if (cnpj) linha.cnpj_seguradora = cnpj;
        if (s.numero_apolice.trim())
          linha.numero_apolice = s.numero_apolice.trim();
        if (s.nome_seguradora.trim())
          linha.nome_seguradora = s.nome_seguradora.trim();
        const averbacoes = s.averbacoes
          .map((a) => a.trim())
          .filter((a) => a.length > 0);
        if (averbacoes.length) linha.numeros_averbacao = averbacoes;
        return linha;
      })
      .filter(Boolean);
    if (segurosPayload.length) payload.seguros = segurosPayload;

    // ide (item 2.5)
    const ide = {};
    if (form.ide_uf_ini.trim())
      ide.uf_ini = form.ide_uf_ini.trim().toUpperCase();
    if (form.ide_uf_fim.trim())
      ide.uf_fim = form.ide_uf_fim.trim().toUpperCase();
    if (form.ide_dh_ini_viagem)
      ide.dh_ini_viagem = new Date(form.ide_dh_ini_viagem).toISOString();
    if (num(form.ide_modal) != null) ide.modal = num(form.ide_modal);
    if (Object.keys(ide).length) payload.ide = ide;

    // infANTT (item 2.2) + infoBancaria / PIX (PARTE 5.5)
    const infAntt = {};
    if (anttRntrcDigits) infAntt.rntrc = anttRntrcDigits;
    if (form.antt_ciot.trim()) infAntt.ciot = form.antt_ciot.trim();
    if (num(form.antt_vale_pedagio_valor) != null)
      infAntt.vale_pedagio = { valor: num(form.antt_vale_pedagio_valor) };
    if (form.antt_cod_banco.trim())
      infAntt.cod_banco = form.antt_cod_banco.trim();
    if (form.antt_cod_agencia.trim())
      infAntt.cod_agencia = form.antt_cod_agencia.trim();
    const cnpjInst = form.antt_cnpj_inst_pagamento.replace(/\D/g, "");
    if (cnpjInst) infAntt.cnpj_instituicao_pagamento = cnpjInst;
    if (form.antt_pix.trim()) infAntt.pix = form.antt_pix.trim();
    if (Object.keys(infAntt).length) payload.inf_antt = infAntt;

    // prodPred (item 2.4 / PARTE 5.6)
    const prodPred = {};
    if (form.prod_pred_descricao.trim())
      prodPred.descricao = form.prod_pred_descricao.trim();
    const ncmDigits = form.prod_pred_ncm.replace(/\D/g, "").slice(0, 8);
    if (ncmDigits) prodPred.ncm = ncmDigits;
    if (form.prod_pred_tp_carga) prodPred.tp_carga = form.prod_pred_tp_carga;
    if (form.prod_pred_c_ean.trim())
      prodPred.c_ean = form.prod_pred_c_ean.trim().toUpperCase();
    const carrega = {};
    const cCep = form.prod_pred_lot_carrega_cep.replace(/\D/g, "");
    if (cCep) carrega.cep = cCep;
    if (num(form.prod_pred_lot_carrega_lat) != null)
      carrega.latitude = num(form.prod_pred_lot_carrega_lat);
    if (num(form.prod_pred_lot_carrega_long) != null)
      carrega.longitude = num(form.prod_pred_lot_carrega_long);
    const descarrega = {};
    const dCep = form.prod_pred_lot_descarrega_cep.replace(/\D/g, "");
    if (dCep) descarrega.cep = dCep;
    if (num(form.prod_pred_lot_descarrega_lat) != null)
      descarrega.latitude = num(form.prod_pred_lot_descarrega_lat);
    if (num(form.prod_pred_lot_descarrega_long) != null)
      descarrega.longitude = num(form.prod_pred_lot_descarrega_long);
    const infLotacao = {};
    if (Object.keys(carrega).length) infLotacao.carrega = carrega;
    if (Object.keys(descarrega).length) infLotacao.descarrega = descarrega;
    if (Object.keys(infLotacao).length) prodPred.inf_lotacao = infLotacao;
    if (Object.keys(prodPred).length) payload.prod_pred = prodPred;

    // infMunCarrega (item 2.5)
    const municipiosPayload = municipiosCarrega
      .map((m) => {
        const linha = {};
        if (m.codigo_municipio.trim())
          linha.codigo_municipio = m.codigo_municipio.trim();
        if (m.nome_municipio.trim())
          linha.nome_municipio = m.nome_municipio.trim();
        return linha;
      })
      .filter((linha) => linha.codigo_municipio);
    if (municipiosPayload.length)
      payload.municipios_carrega = municipiosPayload;

    // infMunDescarga (PARTE 5.1): agrupa os CT-e selecionados por município de
    // descarga informado. Só entra no payload quando o usuário associou pelo
    // menos um; senão, o backend segue com a lista plana de vínculos.
    if (usaMunDescarga && !descargaParcial) {
      const porMunicipio = new Map();
      for (const c of ctesSelecionados) {
        const info = descargaPorCte[c.id] ?? {};
        const cod = String(info.codigo_municipio ?? "").trim();
        if (!cod || !c.chave_acesso) continue;
        if (!porMunicipio.has(cod)) {
          porMunicipio.set(cod, {
            codigo_municipio: cod,
            nome_municipio: String(info.nome_municipio ?? "").trim() || undefined,
            documentos: [],
          });
        }
        porMunicipio
          .get(cod)
          .documentos.push({ tipo: "cte", chave: c.chave_acesso });
      }
      const lista = [...porMunicipio.values()];
      if (lista.length) payload.municipios_descarga = lista;
    }

    if (modoCondutor === "cadastrado" && form.motorista_id) {
      payload.motorista_id = Number(form.motorista_id);
    } else {
      payload.rodoviario = {
        condutores: [
          {
            nome: form.condutor_nome.trim(),
            cpf: form.condutor_cpf.replace(/\D/g, ""),
          },
        ],
      };
    }

    return payload;
  };

  const condutorManualInvalido =
    modoCondutor === "manual" &&
    (form.condutor_nome.trim().length < 1 ||
      form.condutor_cpf.replace(/\D/g, "").length !== 11);

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {empresaFiscal && !empresaFiscal.certificado_senha_set && (
          <Alert
            type="warning"
            message="Sem certificado A1 a autorização na SEFAZ fica pendente. Use Simular emissão para o demo; Emitir só completa com o .pfx cadastrado."
          />
        )}
        <FiscalFormSteps
          steps={MDFE_FASES}
          current={fase}
          onSelect={setFase}
        />

        {fase === 0 && (
        <>
        <div className="grid gap-4 md:grid-cols-2">
          <SearchableSelect
            label="Caminhão"
            value={form.caminhao_id}
            onChange={(v) => set("caminhao_id", v)}
            options={caminhaoOptions}
            placeholder="Placa do veículo…"
            required
            className="mb-0"
          />

          <FormField
            label="Data/hora de emissão"
            type="datetime-local"
            value={form.data_emissao}
            onChange={(e) => set("data_emissao", e.target.value)}
            required
            className="mb-0"
          />

          <UfField
            label="UF de carregamento"
            value={form.uf_carregamento}
            onChange={(e) => set("uf_carregamento", e.target.value)}
            placeholder="SP"
            required
            className="mb-0"
          />

          <UfField
            label="UF de descarregamento"
            value={form.uf_descarregamento}
            onChange={(e) => set("uf_descarregamento", e.target.value)}
            placeholder="MG"
            required
            className="mb-0"
          />

          <MoneyField
            label="Valor da carga"
            value={form.valor}
            onChange={(e) => set("valor", e.target.value)}
            placeholder="0,00"
            className="mb-0"
          />

          <FormField
            label="Peso (kg)"
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
            label="Percurso — UFs"
            value={form.percurso_ufs}
            onChange={(e) =>
              set(
                "percurso_ufs",
                e.target.value.replace(/[^a-zA-Z,\s]/g, "").toUpperCase(),
              )
            }
            placeholder="SP, RJ, MG"
            helperText="Siglas de 2 letras separadas por vírgula ou espaço"
            className="mb-0 md:col-span-2"
          />
        </div>

        <p className="rounded-lg bg-gray-50 px-4 py-3 text-xs text-text-secondary">
          Totalizadores do manifesto (quantidade de CT-e, valor e peso da
          carga) são calculados automaticamente pelo provedor a partir dos
          documentos vinculados — não há campo para informá-los aqui.
        </p>

        {/* ------------------------------------------------------------------ */}
        {/* Item 2.5 — grupo ide */}
        {/* ------------------------------------------------------------------ */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <p className="text-sm font-medium text-text-primary">
            Identificação (grupo ide)
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Tipo de emitente"
              type="select"
              value={form.tipo_emitente}
              onChange={(e) => set("tipo_emitente", e.target.value)}
              options={TIPO_EMITENTE_OPTIONS}
              allowEmpty
              emptyLabel="Não informar (frota própria)"
              helperText="1 ou 3 tornam obrigatórios seguro, infANTT e produto predominante."
              className="mb-0"
            />
            <FormField
              label="Modal"
              type="select"
              value={form.ide_modal}
              onChange={(e) => set("ide_modal", e.target.value)}
              options={MODAL_OPTIONS}
              allowEmpty
              emptyLabel="Selecione…"
              className="mb-0"
            />
            <UfField
              label="UF de início da viagem"
              value={form.ide_uf_ini}
              onChange={(e) => set("ide_uf_ini", e.target.value)}
              placeholder="SP"
              className="mb-0"
            />
            <UfField
              label="UF de fim da viagem"
              value={form.ide_uf_fim}
              onChange={(e) => set("ide_uf_fim", e.target.value)}
              placeholder="MG"
              className="mb-0"
            />
            <FormField
              label="Data/hora de início da viagem"
              type="datetime-local"
              value={form.ide_dh_ini_viagem}
              onChange={(e) => set("ide_dh_ini_viagem", e.target.value)}
              className="mb-0"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-primary">
                Municípios de carregamento (infMunCarrega)
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMunicipio}
              >
                + adicionar
              </Button>
            </div>
            {municipiosCarrega.map((m, idx) => (
              <div
                key={idx}
                className="grid gap-2 md:grid-cols-[1fr_2fr_auto] md:items-end"
              >
                <FormField
                  label="Código IBGE"
                  value={m.codigo_municipio}
                  onChange={(e) =>
                    setMunicipio(
                      idx,
                      "codigo_municipio",
                      e.target.value.replace(/\D/g, "").slice(0, 7),
                    )
                  }
                  placeholder="7 dígitos"
                  maxLength={7}
                  className="mb-0"
                />
                <FormField
                  label="Nome do município"
                  value={m.nome_municipio}
                  onChange={(e) =>
                    setMunicipio(
                      idx,
                      "nome_municipio",
                      semDigitos(e.target.value),
                    )
                  }
                  maxLength={120}
                  className="mb-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMunicipio(idx)}
                  disabled={municipiosCarrega.length === 1}
                >
                  remover
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-text-primary">
              Reboques do manifesto
            </p>
            <p className="text-xs text-text-secondary">
              Resolvidos automaticamente pela composição do veículo na data de
              emissão. Confira antes de emitir — o MDF-e usa exatamente estes
              reboques.
            </p>
          </div>

          {!form.caminhao_id ? (
            <p className="text-sm text-text-secondary">
              Selecione o caminhão para ver os reboques.
            </p>
          ) : reboquesPreview.isLoading ? (
            <p className="text-sm text-text-secondary">Carregando reboques…</p>
          ) : reboquesPreview.isError ? (
            <Alert
              type="error"
              message="Não foi possível pré-visualizar os reboques."
            />
          ) : previewData?.aviso ? (
            <Alert type="warning" message={previewData.aviso} />
          ) : previewData?.reboques?.length ? (
            <ul className="space-y-1 text-sm">
              {previewData.reboques.map((r, i) => (
                <li
                  key={r.placa || i}
                  className="flex items-center gap-2 rounded px-1 py-1"
                >
                  <span className="font-medium text-text-primary">
                    {i + 1}.
                  </span>
                  <span className="font-mono">{r.placa || "—"}</span>
                  {r.tpCarroceria ? (
                    <span className="text-xs text-text-secondary">
                      carroceria {r.tpCarroceria}
                      {r.uf ? ` · ${r.uf}` : ""}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">
              Nenhum reboque — o veículo entra sozinho no manifesto.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border p-4 space-y-4">
          <FormField
            label="Condutor"
            type="select"
            value={modoCondutor}
            onChange={(e) => setModoCondutor(e.target.value)}
            options={[
              {
                value: "cadastrado",
                label: "Escolher motorista cadastrado",
              },
              { value: "manual", label: "Informar nome e CPF manualmente" },
            ]}
            disabled={!temMotoristas}
            helperText={
              temMotoristas
                ? undefined
                : "Nenhum motorista cadastrado — informe manualmente."
            }
            className="mb-0"
          />

          {modoCondutor === "cadastrado" ? (
            <SearchableSelect
              label="Motorista"
              value={form.motorista_id}
              onChange={(v) => set("motorista_id", v)}
              options={motoristaOptions}
              placeholder="Busque pelo nome…"
              required
              className="mb-0"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Nome do condutor"
                value={form.condutor_nome}
                onChange={(e) =>
                  set("condutor_nome", semDigitos(e.target.value))
                }
                maxLength={60}
                required
                className="mb-0"
              />
              <CpfCnpjField
                label="CPF do condutor"
                value={form.condutor_cpf}
                onChange={(e) => set("condutor_cpf", e.target.value)}
                placeholder="Somente números"
                soCpf
                required
                className="mb-0"
              />
            </div>
          )}
        </div>
        </>
        )}

        {fase === 1 && (
        <>
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-text-primary">
              Documentos vinculados
            </p>
            <p className="text-xs text-text-secondary">
              CT-e já emitidos e ainda não vinculados a um MDF-e. Os
              selecionados recebem o vínculo com este manifesto após a emissão.
            </p>
          </div>
          {ctesVinculaveis.length === 0 ? (
            <p className="text-sm text-text-secondary">
              Nenhum CT-e disponível para vincular.
            </p>
          ) : (
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {ctesVinculaveis.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={cteIds.includes(c.id)}
                    onChange={() => toggleCte(c.id)}
                  />
                  <span>
                    {[c.numero, c.serie].filter(Boolean).join("/") ||
                      `CT-e #${c.id}`}
                    {c.chave_acesso ? ` — ${c.chave_acesso}` : ""}
                  </span>
                </label>
              ))}
            </div>
          )}
          {cteIds.length > 0 && (
            <p className="text-xs text-text-secondary">
              {cteIds.length} CT-e selecionado(s).
            </p>
          )}

          {/* ------------------------------------------------------------ */}
          {/* PARTE 5.1 — infMunDescarga: município de descarga por CT-e */}
          {/* ------------------------------------------------------------ */}
          {ctesSelecionados.length > 0 && (
            <div className="space-y-2 rounded border border-border p-3">
              <p className="text-sm font-medium text-text-primary">
                Município de descarga por documento (infMunDescarga)
              </p>
              <p className="text-xs text-text-secondary">
                Opcional. Se informar para um CT-e, informe para todos os
                selecionados — o manifesto passa a agrupar os documentos por
                município de descarregamento.
              </p>
              {descargaParcial && (
                <p className="text-xs text-danger">
                  Faltam municípios de descarga para{" "}
                  {ctesSelecionados.length - descargaPreenchidos.length} CT-e
                  selecionado(s).
                </p>
              )}
              {ctesSelecionados.map((c) => (
                <div
                  key={c.id}
                  className="grid gap-2 md:grid-cols-[1.2fr_1fr_1.5fr] md:items-end"
                >
                  <span className="text-xs text-text-secondary">
                    {[c.numero, c.serie].filter(Boolean).join("/") ||
                      `CT-e #${c.id}`}
                  </span>
                  <FormField
                    label="Código IBGE"
                    value={descargaPorCte[c.id]?.codigo_municipio ?? ""}
                    onChange={(e) =>
                      setDescarga(
                        c.id,
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
                    value={descargaPorCte[c.id]?.nome_municipio ?? ""}
                    onChange={(e) =>
                      setDescarga(c.id, "nome_municipio", e.target.value)
                    }
                    maxLength={120}
                    className="mb-0"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}

        {fase === 2 && (
        <>
        {/* ------------------------------------------------------------------ */}
        {/* Item 2.1 / PARTE 5.4 — Seguro da carga (lista) */}
        {/* ------------------------------------------------------------------ */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Seguro da carga (grupo seg)
              </p>
              <p className="text-xs text-text-secondary">
                Um ou mais seguros, cada um com zero ou mais averbações.
                {exigeAntt
                  ? " Obrigatório para emitente prestador de serviço (tipo 1 ou 3)."
                  : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSeguro}
            >
              + adicionar seguro
            </Button>
          </div>

          {seguroPendente && (
            <p className="text-xs text-danger">
              Informe ao menos um seguro com o responsável definido.
            </p>
          )}

          {seguros.map((s, si) => (
            <div
              key={si}
              className="space-y-3 rounded border border-border p-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text-primary">
                  Seguro {si + 1}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSeguro(si)}
                  disabled={seguros.length === 1}
                >
                  remover
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="Responsável pelo seguro"
                  type="select"
                  value={s.responsavel}
                  onChange={(e) => setSeguro(si, "responsavel", e.target.value)}
                  options={RESP_SEG_OPTIONS}
                  allowEmpty
                  emptyLabel="Selecione…"
                  className="mb-0"
                />
                <FormField
                  label="Nome da seguradora (opcional)"
                  value={s.nome_seguradora}
                  onChange={(e) =>
                    setSeguro(si, "nome_seguradora", e.target.value)
                  }
                  maxLength={60}
                  className="mb-0"
                />
                <CpfCnpjField
                  label="CNPJ da seguradora (opcional)"
                  value={s.cnpj_seguradora}
                  onChange={(e) =>
                    setSeguro(si, "cnpj_seguradora", e.target.value)
                  }
                  placeholder="Somente números"
                  soCnpj
                  className="mb-0"
                />
                <FormField
                  label="Número da apólice (opcional)"
                  value={s.numero_apolice}
                  onChange={(e) =>
                    setSeguro(si, "numero_apolice", e.target.value)
                  }
                  maxLength={40}
                  className="mb-0"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-text-secondary">
                    Averbações
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addAverbacao(si)}
                  >
                    + averbação
                  </Button>
                </div>
                {s.averbacoes.map((a, ai) => (
                  <div
                    key={ai}
                    className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end"
                  >
                    <FormField
                      label={`Averbação ${ai + 1}`}
                      value={a}
                      onChange={(e) => setAverbacao(si, ai, e.target.value)}
                      maxLength={20}
                      className="mb-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAverbacao(si, ai)}
                      disabled={s.averbacoes.length === 1}
                    >
                      remover
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Item 2.2 / PARTE 5.5 — infANTT + infoBancaria / PIX */}
        {/* ------------------------------------------------------------------ */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-text-primary">
              ANTT (grupo infANTT)
            </p>
            <p className="text-xs text-text-secondary">
              {exigeAntt
                ? "Obrigatório para emitente prestador de serviço (tipo 1 ou 3)."
                : "Preencha quando o emitente for prestador de serviço de transporte."}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="RNTRC"
              value={form.antt_rntrc}
              onChange={(e) =>
                set(
                  "antt_rntrc",
                  e.target.value.replace(/\D/g, "").slice(0, 9),
                )
              }
              placeholder="Somente números"
              maxLength={9}
              required={exigeAntt}
              error={
                anttPendente
                  ? "Informe o RNTRC para emitente prestador de serviço."
                  : undefined
              }
              helperText="Se a empresa fiscal já tem RNTRC cadastrado, informe o mesmo aqui."
              className="mb-0"
            />
            <FormField
              label="CIOT vinculado (se houver)"
              value={form.antt_ciot}
              onChange={(e) =>
                set("antt_ciot", e.target.value.replace(/\D/g, "").slice(0, 12))
              }
              placeholder="Número do CIOT"
              inputMode="numeric"
              maxLength={12}
              className="mb-0"
            />
            <MoneyField
              label="Vale-pedágio — valor (opcional)"
              value={form.antt_vale_pedagio_valor}
              onChange={(e) =>
                set("antt_vale_pedagio_valor", e.target.value)
              }
              placeholder="0,00"
              className="mb-0"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-text-primary">
              Instituição de pagamento do frete (infoBancaria / PIX)
            </p>
            <p className="text-xs text-text-secondary">
              Opcional. Vai no grupo pagamentos[].infoBancaria do manifesto.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Código do banco"
                value={form.antt_cod_banco}
                onChange={(e) =>
                  set(
                    "antt_cod_banco",
                    e.target.value.replace(/\D/g, "").slice(0, 5),
                  )
                }
                placeholder="Ex.: 001"
                maxLength={5}
                className="mb-0"
              />
              <FormField
                label="Código da agência"
                value={form.antt_cod_agencia}
                onChange={(e) =>
                  set(
                    "antt_cod_agencia",
                    e.target.value.replace(/\D/g, "").slice(0, 10),
                  )
                }
                placeholder="Ex.: 1234"
                maxLength={10}
                className="mb-0"
              />
              <CpfCnpjField
                label="CNPJ da instituição de pagamento"
                value={form.antt_cnpj_inst_pagamento}
                onChange={(e) =>
                  set("antt_cnpj_inst_pagamento", e.target.value)
                }
                placeholder="Somente números"
                className="mb-0"
              />
              <FormField
                label="Chave PIX"
                value={form.antt_pix}
                onChange={(e) => set("antt_pix", e.target.value)}
                placeholder="Chave PIX da instituição"
                maxLength={120}
                className="mb-0"
              />
            </div>
          </div>
        </div>
        </>
        )}

        {fase === 3 && (
        <>
        {/* ------------------------------------------------------------------ */}
        {/* Item 2.4 / PARTE 5.6 — produto predominante (prodPred) */}
        {/* ------------------------------------------------------------------ */}
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-text-primary">
              Produto predominante (grupo prodPred)
            </p>
            <p className="text-xs text-text-secondary">
              {exigeAntt
                ? "Obrigatório para emitente prestador de serviço (tipo 1 ou 3)."
                : "Descreva o produto predominante transportado."}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Descrição"
              value={form.prod_pred_descricao}
              onChange={(e) => set("prod_pred_descricao", e.target.value)}
              placeholder="Ex.: Milho a granel"
              maxLength={120}
              required={exigeAntt}
              error={
                prodPredPendente
                  ? "Informe o produto predominante para emitente prestador de serviço."
                  : undefined
              }
              className="mb-0"
            />
            <FormField
              label="NCM"
              value={form.prod_pred_ncm}
              onChange={(e) =>
                set(
                  "prod_pred_ncm",
                  e.target.value.replace(/\D/g, "").slice(0, 8),
                )
              }
              placeholder="8 dígitos"
              maxLength={8}
              helperText={
                ncmRecomendado
                  ? "Recomendado: o manifesto tem só 1 documento vinculado."
                  : undefined
              }
              className="mb-0"
            />
            <FormField
              label="Tipo de carga (tpCarga)"
              type="select"
              value={form.prod_pred_tp_carga}
              onChange={(e) => set("prod_pred_tp_carga", e.target.value)}
              options={TP_CARGA_OPTIONS}
              allowEmpty
              emptyLabel="Selecione…"
              className="mb-0"
            />
            <FormField
              label="GTIN (cEAN)"
              value={form.prod_pred_c_ean}
              onChange={(e) => set("prod_pred_c_ean", e.target.value)}
              placeholder='GTIN ou "SEM GTIN"'
              maxLength={14}
              helperText='Use "SEM GTIN" quando o produto não tem código de barras.'
              className="mb-0"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-text-primary">
              Geolocalização da lotação (infLotacao) — opcional
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                label="CEP de carregamento"
                value={form.prod_pred_lot_carrega_cep}
                onChange={(e) =>
                  set(
                    "prod_pred_lot_carrega_cep",
                    e.target.value.replace(/\D/g, "").slice(0, 8),
                  )
                }
                placeholder="8 dígitos"
                maxLength={8}
                className="mb-0"
              />
              <FormField
                label="Latitude carregamento"
                type="number"
                step="0.0000001"
                min={-90}
                max={90}
                value={form.prod_pred_lot_carrega_lat}
                onChange={(e) =>
                  set("prod_pred_lot_carrega_lat", e.target.value)
                }
                placeholder="-23.5505"
                className="mb-0"
              />
              <FormField
                label="Longitude carregamento"
                type="number"
                step="0.0000001"
                min={-180}
                max={180}
                value={form.prod_pred_lot_carrega_long}
                onChange={(e) =>
                  set("prod_pred_lot_carrega_long", e.target.value)
                }
                placeholder="-46.6333"
                className="mb-0"
              />
              <FormField
                label="CEP de descarregamento"
                value={form.prod_pred_lot_descarrega_cep}
                onChange={(e) =>
                  set(
                    "prod_pred_lot_descarrega_cep",
                    e.target.value.replace(/\D/g, "").slice(0, 8),
                  )
                }
                placeholder="8 dígitos"
                maxLength={8}
                className="mb-0"
              />
              <FormField
                label="Latitude descarregamento"
                type="number"
                step="0.0000001"
                min={-90}
                max={90}
                value={form.prod_pred_lot_descarrega_lat}
                onChange={(e) =>
                  set("prod_pred_lot_descarrega_lat", e.target.value)
                }
                placeholder="-19.9167"
                className="mb-0"
              />
              <FormField
                label="Longitude descarregamento"
                type="number"
                step="0.0000001"
                min={-180}
                max={180}
                value={form.prod_pred_lot_descarrega_long}
                onChange={(e) =>
                  set("prod_pred_lot_descarrega_long", e.target.value)
                }
                placeholder="-43.9345"
                className="mb-0"
              />
            </div>
          </div>
        </div>
        </>
        )}

        <FiscalFormStepNav
          current={fase}
          total={MDFE_FASES.length}
          onPrev={() => setFase((f) => Math.max(0, f - 1))}
          onNext={() => setFase((f) => Math.min(MDFE_FASES.length - 1, f + 1))}
        >
          {typeof onSaveDraft === "function" && (
            <Button
              type="button"
              variant="outline"
              loading={savingDraft}
              onClick={handleSaveDraft}
            >
              Salvar rascunho
            </Button>
          )}
          {fase === MDFE_FASES.length - 1 && (
          <>
          {typeof onSimular === "function" && (
            <Button
              type="button"
              variant="outline"
              loading={simulating}
              disabled={!form.caminhao_id}
              onClick={handleSimular}
            >
              Simular emissão
            </Button>
          )}
          <Button
            type="submit"
            loading={submitting}
            disabled={
              !form.caminhao_id ||
              form.uf_carregamento.trim().length !== 2 ||
              form.uf_descarregamento.trim().length !== 2 ||
              seguroPendente ||
              descargaParcial ||
              (modoCondutor === "cadastrado" && !form.motorista_id) ||
              condutorManualInvalido ||
              anttPendente ||
              prodPredPendente
            }
          >
            Emitir MDF-e
          </Button>
          </>
          )}
        </FiscalFormStepNav>
      </form>
    </Card>
  );
}

MdfeForm.propTypes = {
  caminhoes: PropTypes.array,
  motoristas: PropTypes.array,
  ctesVinculaveis: PropTypes.array,
  submitting: PropTypes.bool,
  savingDraft: PropTypes.bool,
  simulating: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
  onSaveDraft: PropTypes.func,
  onSimular: PropTypes.func,
  initialPayload: PropTypes.object,
  empresaFiscal: PropTypes.object,
};
