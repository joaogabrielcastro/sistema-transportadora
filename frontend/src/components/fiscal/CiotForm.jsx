import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Button, Card, FormField, SearchableSelect } from "../ui";
import { FiscalFormSteps, FiscalFormStepNav } from "./FiscalFormSteps.jsx";
import { formatCaminhaoOptions } from "../../utils/caminhaoOptions.js";
import { CpfCnpjField, MoneyField } from "./FiscalFields.jsx";
import { WEIGHT_CEILING_14_3 } from "../../utils/fiscalFieldMask.js";
import { resolverEmpresaFiscalAtiva } from "../../utils/fiscalForms.js";
import {
  TIPO_OPERACAO_CIOT,
  TIPO_PAGAMENTO_CIOT,
  exigeDestinatarioCargaCiot,
  exigeIndicadoresCiot,
  montarPayloadCiot,
  errosDeclaracaoCiot,
} from "../../utils/ciotForms.js";

const CIOT_FASES = ["Operação", "Contrato", "Viagem e carga", "Frota e pagamento"];

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

const novoVeiculo = () => ({ placa: "", rntrc_veiculo: "", numero_eixos: "" });
const novoPagamento = (valor = "") => ({ tipo_pagamento: "1", valor });

const emptyForm = {
  fiscal_empresa_id: "",
  caminhao_id: "",
  motorista_id: "",
  mdfe_id: "",
  tipo_operacao: "1",
  cpf_cnpj_contratado: "",
  rntrc_contratado: "",
  cpf_cnpj_contratante: "",
  rntrc_contratante: "",
  cpf_cnpj_destinatario: "",
  valor_frete: "",
  valor_piso_minimo_frete: "",
  valor_vale_pedagio: "0",
  data_declaracao: nowLocalInput(),
  data_inicio_viagem: todayDate(),
  data_fim_viagem: todayDate(),
  codigo_municipio_origem: "",
  codigo_municipio_destino: "",
  codigo_natureza_carga: "",
  peso_carga: "",
  codigo_tipo_carga: "1",
  carga_ncm: "",
  possui_rastreamento: false,
  possui_seguro_carga: false,
};

/**
 * Declaração de operação de transporte (CIOT / contrato de frete).
 * `fiscal_empresa_id` é obrigatório no backend — o certificado mTLS sai dela.
 */
export default function CiotForm({
  empresas = [],
  caminhoes = [],
  motoristas = [],
  mdfes = [],
  submitting = false,
  simulating = false,
  onSubmit,
  onSimular,
}) {
  const [form, setForm] = useState(emptyForm);
  const [veiculos, setVeiculos] = useState([novoVeiculo(), novoVeiculo()]);
  const [pagamentos, setPagamentos] = useState([novoPagamento()]);
  const [erroLocal, setErroLocal] = useState("");
  const [fase, setFase] = useState(0);

  const empresaAtiva = useMemo(
    () => resolverEmpresaFiscalAtiva(empresas),
    [empresas],
  );

  useEffect(() => {
    if (!empresaAtiva?.id) return;
    setForm((f) => {
      if (f.fiscal_empresa_id) return f;
      return {
        ...f,
        fiscal_empresa_id: String(empresaAtiva.id),
        cpf_cnpj_contratante: f.cpf_cnpj_contratante || empresaAtiva.cnpj || "",
        rntrc_contratante: f.rntrc_contratante || empresaAtiva.rntrc || "",
      };
    });
  }, [empresaAtiva]);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const empresaSelecionada = empresas.find(
    (e) => String(e.id) === String(form.fiscal_empresa_id),
  );
  const semCertificado =
    empresaSelecionada && empresaSelecionada.certificado_senha_set === false;
  const tipo = form.tipo_operacao;
  const mostraCarga = exigeDestinatarioCargaCiot(tipo);
  const mostraIndicadores = exigeIndicadoresCiot(tipo);

  const caminhaoOptions = useMemo(
    () => formatCaminhaoOptions(caminhoes),
    [caminhoes],
  );
  const motoristaOptions = useMemo(
    () =>
      motoristas.map((m) => ({
        value: String(m.id),
        label: m.nome || `#${m.id}`,
      })),
    [motoristas],
  );
  const empresaOptions = useMemo(
    () =>
      empresas.map((e) => ({
        value: String(e.id),
        label: `${e.razao_social || "Empresa"} — ${e.cnpj || ""}`.trim(),
      })),
    [empresas],
  );
  const mdfeOptions = useMemo(
    () =>
      mdfes.map((m) => ({
        value: String(m.id),
        label: [m.numero, m.chave_acesso?.slice(-8)].filter(Boolean).join(" · ") ||
          `MDF-e #${m.id}`,
      })),
    [mdfes],
  );

  const onPickCaminhao = (id) => {
    set("caminhao_id", id);
    const caminhao = caminhoes.find((c) => String(c.id) === String(id));
    if (!caminhao?.placa) return;
    setVeiculos((vs) => {
      if (vs[0]?.placa) return vs;
      const next = [...vs];
      next[0] = { ...next[0], placa: String(caminhao.placa).toUpperCase() };
      return next;
    });
  };

  const setVeiculo = (idx, campo, valor) =>
    setVeiculos((vs) => vs.map((v, i) => (i === idx ? { ...v, [campo]: valor } : v)));

  const setPagamento = (idx, campo, valor) =>
    setPagamentos((ps) =>
      ps.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)),
    );

  const payloadValidado = () => {
    const payload = montarPayloadCiot({ form, veiculos, pagamentos });
    const erros = errosDeclaracaoCiot(payload);
    if (erros.length) {
      setErroLocal(erros.join("\n"));
      return null;
    }
    setErroLocal("");
    return payload;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (fase < CIOT_FASES.length - 1) {
      setFase((f) => f + 1);
      return;
    }
    const payload = payloadValidado();
    if (!payload) return;
    onSubmit?.(payload);
  };

  const handleSimular = () => {
    const payload = payloadValidado();
    if (!payload) return;
    onSimular?.(payload);
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {erroLocal && (
          <Alert type="error">
            <span className="whitespace-pre-line">{erroLocal}</span>
          </Alert>
        )}
        {empresas.length === 0 && (
          <Alert
            type="warning"
            message="Cadastre a empresa fiscal (CNPJ emissor) antes de declarar o CIOT. Sem ela o certificado A1 e o RNTRC não entram na declaração."
          />
        )}
        {semCertificado && (
          <Alert type="warning">
            A empresa fiscal selecionada está sem certificado digital (PFX +
            senha). Use Simular declaração para mostrar o fluxo ao cliente;
            Declarar só completa com o .pfx cadastrado (mTLS com o provedor).
          </Alert>
        )}

        <FiscalFormSteps
          steps={CIOT_FASES}
          current={fase}
          onSelect={setFase}
        />

        {fase === 0 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">Operação</p>
              <p className="text-xs text-text-secondary">
                Contrato de frete eletrônico (CIOT). Piso mínimo e vale-pedágio
                são obrigatórios por lei — informe 0 no pedágio se não houver no
                percurso.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <SearchableSelect
                label="Empresa fiscal (certificado)"
                required
                value={form.fiscal_empresa_id}
                onChange={(v) => set("fiscal_empresa_id", v)}
                options={empresaOptions}
                placeholder="Selecione a empresa emissora"
                helperText="O CNPJ desta empresa precisa ser o contratado ou o contratante."
              />
              <FormField
                label="Tipo de operação"
                type="select"
                required
                value={form.tipo_operacao}
                onChange={(e) => set("tipo_operacao", e.target.value)}
                options={TIPO_OPERACAO_CIOT}
              />
              <SearchableSelect
                label="Caminhão (opcional)"
                value={form.caminhao_id}
                onChange={onPickCaminhao}
                options={caminhaoOptions}
                allowEmpty
                emptyLabel="Nenhum"
              />
              <SearchableSelect
                label="Motorista (opcional)"
                value={form.motorista_id}
                onChange={(v) => set("motorista_id", v)}
                options={motoristaOptions}
                allowEmpty
                emptyLabel="Nenhum"
              />
              <SearchableSelect
                label="MDF-e vinculado (opcional)"
                value={form.mdfe_id}
                onChange={(v) => set("mdfe_id", v)}
                options={mdfeOptions}
                allowEmpty
                emptyLabel="Sem MDF-e"
              />
            </div>
          </div>
        )}

        {fase === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-text-primary">
              Contrato — partes
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <CpfCnpjField
                label="CPF/CNPJ do contratado"
                required
                value={form.cpf_cnpj_contratado}
                onChange={(e) => set("cpf_cnpj_contratado", e.target.value)}
              />
              <FormField
                label="RNTRC do contratado"
                required
                inputMode="numeric"
                maxLength={9}
                value={form.rntrc_contratado}
                onChange={(e) =>
                  set("rntrc_contratado", e.target.value.replace(/\D/g, "").slice(0, 9))
                }
              />
              <CpfCnpjField
                label="CPF/CNPJ do contratante"
                required
                value={form.cpf_cnpj_contratante}
                onChange={(e) => set("cpf_cnpj_contratante", e.target.value)}
              />
              <FormField
                label="RNTRC do contratante"
                inputMode="numeric"
                maxLength={9}
                value={form.rntrc_contratante}
                onChange={(e) =>
                  set("rntrc_contratante", e.target.value.replace(/\D/g, "").slice(0, 9))
                }
              />
              {mostraCarga && (
                <CpfCnpjField
                  label="CPF/CNPJ do destinatário"
                  required
                  value={form.cpf_cnpj_destinatario}
                  onChange={(e) => set("cpf_cnpj_destinatario", e.target.value)}
                />
              )}
            </div>
          </div>
        )}

        {fase === 2 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-text-primary">
                Valores e datas
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <MoneyField
                  label="Valor do frete"
                  required
                  value={form.valor_frete}
                  onChange={(e) => set("valor_frete", e.target.value)}
                />
                <MoneyField
                  label="Piso mínimo ANTT"
                  required
                  helperText="Informe o valor da tabela vigente."
                  value={form.valor_piso_minimo_frete}
                  onChange={(e) => set("valor_piso_minimo_frete", e.target.value)}
                />
                <MoneyField
                  label="Vale-pedágio"
                  required
                  helperText="0 se não houver pedágio."
                  value={form.valor_vale_pedagio}
                  onChange={(e) => set("valor_vale_pedagio", e.target.value)}
                />
                <FormField
                  label="Data da declaração"
                  type="datetime-local"
                  required
                  value={form.data_declaracao}
                  onChange={(e) => set("data_declaracao", e.target.value)}
                />
                <FormField
                  label="Início da viagem"
                  type="date"
                  required
                  value={form.data_inicio_viagem}
                  onChange={(e) => set("data_inicio_viagem", e.target.value)}
                />
                <FormField
                  label="Fim da viagem"
                  type="date"
                  required
                  value={form.data_fim_viagem}
                  onChange={(e) => set("data_fim_viagem", e.target.value)}
                />
              </div>
            </div>

            {mostraCarga && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-text-primary">
                  Origem, destino e carga
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    label="Município origem (IBGE)"
                    required
                    inputMode="numeric"
                    maxLength={7}
                    value={form.codigo_municipio_origem}
                    onChange={(e) =>
                      set(
                        "codigo_municipio_origem",
                        e.target.value.replace(/\D/g, "").slice(0, 7),
                      )
                    }
                  />
                  <FormField
                    label="Município destino (IBGE)"
                    required
                    inputMode="numeric"
                    maxLength={7}
                    value={form.codigo_municipio_destino}
                    onChange={(e) =>
                      set(
                        "codigo_municipio_destino",
                        e.target.value.replace(/\D/g, "").slice(0, 7),
                      )
                    }
                  />
                  <FormField
                    label="Natureza da carga"
                    required
                    maxLength={20}
                    value={form.codigo_natureza_carga}
                    onChange={(e) => set("codigo_natureza_carga", e.target.value)}
                  />
                  <FormField
                    label="Peso da carga (kg)"
                    type="number"
                    required
                    min={0}
                    max={WEIGHT_CEILING_14_3}
                    step="0.001"
                    useGrouping={false}
                    value={form.peso_carga}
                    onChange={(e) => set("peso_carga", e.target.value)}
                  />
                  <FormField
                    label="Tipo da carga"
                    type="number"
                    required
                    min={0}
                    step="1"
                    value={form.codigo_tipo_carga}
                    onChange={(e) => set("codigo_tipo_carga", e.target.value)}
                  />
                  <FormField
                    label="NCM (opcional)"
                    inputMode="numeric"
                    maxLength={8}
                    value={form.carga_ncm}
                    onChange={(e) =>
                      set("carga_ncm", e.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                  />
                </div>
              </div>
            )}

            {mostraIndicadores && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-text-primary">
                  Indicadores operacionais
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.possui_rastreamento}
                    onChange={(e) => set("possui_rastreamento", e.target.checked)}
                  />
                  Possui rastreamento
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.possui_seguro_carga}
                    onChange={(e) => set("possui_seguro_carga", e.target.checked)}
                  />
                  Possui seguro da carga
                </label>
              </div>
            )}

            {!mostraCarga && (
              <p className="text-xs text-text-secondary">
                TAC-Agregado não exige destinatário, origem/destino nem carga.
              </p>
            )}
          </div>
        )}

        {fase === 3 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-text-primary">
                  Veículos (2 a 5)
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={veiculos.length >= 5}
                  onClick={() => setVeiculos((vs) => [...vs, novoVeiculo()])}
                >
                  Adicionar veículo
                </Button>
              </div>
              {veiculos.map((v, idx) => (
                <div key={idx} className="grid gap-3 md:grid-cols-4">
                  <FormField
                    label={`Placa ${idx + 1}`}
                    required
                    mask="placa"
                    value={v.placa}
                    onChange={(e) => setVeiculo(idx, "placa", e.target.value)}
                  />
                  <FormField
                    label="RNTRC do veículo"
                    required
                    inputMode="numeric"
                    maxLength={9}
                    value={v.rntrc_veiculo}
                    onChange={(e) =>
                      setVeiculo(
                        idx,
                        "rntrc_veiculo",
                        e.target.value.replace(/\D/g, "").slice(0, 9),
                      )
                    }
                  />
                  <FormField
                    label="Eixos"
                    type="number"
                    required
                    min={1}
                    step="1"
                    value={v.numero_eixos}
                    onChange={(e) => setVeiculo(idx, "numero_eixos", e.target.value)}
                  />
                  {veiculos.length > 2 && (
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setVeiculos((vs) => vs.filter((_, i) => i !== idx))
                        }
                      >
                        Remover
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-text-primary">Pagamento</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagamentos((ps) => [...ps, novoPagamento(form.valor_frete)])
                  }
                >
                  Adicionar parcela
                </Button>
              </div>
              {pagamentos.map((p, idx) => (
                <div key={idx} className="grid gap-3 md:grid-cols-3">
                  <FormField
                    label="Tipo de pagamento"
                    type="select"
                    required
                    value={p.tipo_pagamento}
                    onChange={(e) =>
                      setPagamento(idx, "tipo_pagamento", e.target.value)
                    }
                    options={TIPO_PAGAMENTO_CIOT}
                  />
                  <MoneyField
                    label="Valor"
                    required
                    value={p.valor}
                    onChange={(e) => setPagamento(idx, "valor", e.target.value)}
                  />
                  {pagamentos.length > 1 && (
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setPagamentos((ps) => ps.filter((_, i) => i !== idx))
                        }
                      >
                        Remover
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <FiscalFormStepNav
          current={fase}
          total={CIOT_FASES.length}
          onPrev={() => setFase((f) => Math.max(0, f - 1))}
          onNext={() => setFase((f) => Math.min(CIOT_FASES.length - 1, f + 1))}
        >
          {fase === CIOT_FASES.length - 1 && (
            <>
              {typeof onSimular === "function" && (
                <Button
                  type="button"
                  variant="outline"
                  loading={simulating}
                  disabled={!form.fiscal_empresa_id}
                  onClick={handleSimular}
                >
                  Simular declaração
                </Button>
              )}
              <Button type="submit" variant="primary" loading={submitting}>
                Declarar contrato de frete
              </Button>
            </>
          )}
        </FiscalFormStepNav>
      </form>
    </Card>
  );
}

CiotForm.propTypes = {
  empresas: PropTypes.array,
  caminhoes: PropTypes.array,
  motoristas: PropTypes.array,
  mdfes: PropTypes.array,
  submitting: PropTypes.bool,
  simulating: PropTypes.bool,
  onSubmit: PropTypes.func,
  onSimular: PropTypes.func,
};
