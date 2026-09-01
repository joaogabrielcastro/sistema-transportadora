import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button, Card, FormField, SearchableSelect } from "../ui";
import { formatCaminhaoOptions } from "../../utils/caminhaoOptions.js";

function nowLocalInput() {
  const d = new Date();
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
  resp_seg: "",
  cnpj_seguradora: "",
  numero_apolice: "",
  numero_averbacao: "",
};

const RESP_SEG_OPTIONS = [
  { value: "1", label: "1 — Emitente do MDF-e" },
  { value: "2", label: "2 — Contratante do serviço de transporte" },
];

/**
 * Formulário de emissão de MDF-e. Sem campo de `fiscal_empresa_id` — o backend
 * resolve a empresa fiscal ativa do tenant.
 */
export default function MdfeForm({
  caminhoes = [],
  motoristas = [],
  ctesVinculaveis = [],
  submitting = false,
  onSubmit,
}) {
  const [form, setForm] = useState(emptyForm);
  const [cteIds, setCteIds] = useState([]);
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

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

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

  const handleSubmit = (e) => {
    e.preventDefault();

    const num = (v) => {
      if (v === "" || v == null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const percurso = form.percurso_ufs
      .split(/[,\s]+/)
      .map((uf) => uf.trim().toUpperCase())
      .filter((uf) => uf.length === 2);

    const payload = {
      caminhao_id: Number(form.caminhao_id),
      data_emissao: new Date(form.data_emissao).toISOString(),
      uf_carregamento: form.uf_carregamento.trim().toUpperCase(),
      uf_descarregamento: form.uf_descarregamento.trim().toUpperCase(),
      rodoviario: {},
    };

    const valor = num(form.valor);
    const peso = num(form.peso);
    if (valor != null) payload.valor = valor;
    if (peso != null) payload.peso = peso;
    if (percurso.length) payload.percurso_ufs = percurso;
    if (cteIds.length) payload.cte_ids = cteIds;

    if (form.resp_seg) payload.resp_seg = Number(form.resp_seg);
    const cnpjSeg = form.cnpj_seguradora.replace(/\D/g, "");
    if (cnpjSeg) payload.cnpj_seguradora = cnpjSeg;
    if (form.numero_apolice.trim())
      payload.numero_apolice = form.numero_apolice.trim();
    if (form.numero_averbacao.trim())
      payload.numero_averbacao = form.numero_averbacao.trim();

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

    onSubmit(payload);
  };

  const condutorManualInvalido =
    modoCondutor === "manual" &&
    (form.condutor_nome.trim().length < 1 ||
      form.condutor_cpf.replace(/\D/g, "").length !== 11);

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
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

          <FormField
            label="UF de carregamento"
            value={form.uf_carregamento}
            onChange={(e) => set("uf_carregamento", e.target.value)}
            placeholder="SP"
            maxLength={2}
            required
            className="mb-0"
          />

          <FormField
            label="UF de descarregamento"
            value={form.uf_descarregamento}
            onChange={(e) => set("uf_descarregamento", e.target.value)}
            placeholder="MG"
            maxLength={2}
            required
            className="mb-0"
          />

          <FormField
            label="Valor da carga"
            type="number"
            step="0.01"
            value={form.valor}
            onChange={(e) => set("valor", e.target.value)}
            placeholder="0,00"
            className="mb-0"
          />

          <FormField
            label="Peso (kg)"
            type="number"
            step="0.001"
            value={form.peso}
            onChange={(e) => set("peso", e.target.value)}
            placeholder="0"
            className="mb-0"
          />

          <FormField
            label="Percurso — UFs"
            value={form.percurso_ufs}
            onChange={(e) => set("percurso_ufs", e.target.value)}
            placeholder="SP, RJ, MG"
            helperText="Siglas separadas por vírgula ou espaço"
            className="mb-0 md:col-span-2"
          />
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
                onChange={(e) => set("condutor_nome", e.target.value)}
                required
                className="mb-0"
              />
              <FormField
                label="CPF do condutor"
                value={form.condutor_cpf}
                onChange={(e) => set("condutor_cpf", e.target.value)}
                placeholder="Somente números"
                required
                className="mb-0"
              />
            </div>
          )}
        </div>

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
        </div>

        <div className="rounded-lg border border-border p-4 space-y-4">
          <p className="text-sm font-medium text-text-primary">
            Seguro da carga
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Responsável pelo seguro"
              type="select"
              value={form.resp_seg}
              onChange={(e) => set("resp_seg", e.target.value)}
              options={RESP_SEG_OPTIONS}
              allowEmpty
              emptyLabel="Selecione…"
              required
              className="mb-0"
            />
            <FormField
              label="CNPJ da seguradora (opcional)"
              value={form.cnpj_seguradora}
              onChange={(e) => set("cnpj_seguradora", e.target.value)}
              placeholder="Somente números"
              className="mb-0"
            />
            <FormField
              label="Número da apólice (opcional)"
              value={form.numero_apolice}
              onChange={(e) => set("numero_apolice", e.target.value)}
              className="mb-0"
            />
            <FormField
              label="Número da averbação (opcional)"
              value={form.numero_averbacao}
              onChange={(e) => set("numero_averbacao", e.target.value)}
              className="mb-0"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            loading={submitting}
            disabled={
              !form.caminhao_id ||
              form.uf_carregamento.trim().length !== 2 ||
              form.uf_descarregamento.trim().length !== 2 ||
              !form.resp_seg ||
              (modoCondutor === "cadastrado" && !form.motorista_id) ||
              condutorManualInvalido
            }
          >
            Emitir MDF-e
          </Button>
        </div>
      </form>
    </Card>
  );
}

MdfeForm.propTypes = {
  caminhoes: PropTypes.array,
  motoristas: PropTypes.array,
  ctesVinculaveis: PropTypes.array,
  submitting: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
};
