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
  chave_nfe_referenciada: "",
  rntrc: "",
};

/**
 * Formulário de emissão de CT-e Normal (tipo "0"). Complemento de Valores (1) e
 * Substituto (3) têm formulários próprios na aba "Emitidos" (CteReferenciaModal).
 * `fiscal_empresa_id` não é pedido: o backend resolve a única empresa fiscal
 * ativa do tenant.
 */
export default function CteForm({
  clientes = [],
  caminhoes = [],
  submitting = false,
  onSubmit,
}) {
  const { post } = useApiMutation();
  const [form, setForm] = useState(emptyForm);
  const [novoClienteOpen, setNovoClienteOpen] = useState(false);
  const [novoCliente, setNovoCliente] = useState({
    razao_social: "",
    cnpj_cpf: "",
  });
  const [criandoCliente, setCriandoCliente] = useState(false);
  const [erroCliente, setErroCliente] = useState("");

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

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

    const num = (v) => {
      if (v === "" || v == null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const carga = {};
    if (num(form.valor_carga) != null) carga.valor_carga = num(form.valor_carga);
    if (num(form.peso) != null) carga.peso = num(form.peso);
    if (form.produto_predominante.trim())
      carga.produto_predominante = form.produto_predominante.trim();

    const payload = {
      cliente_id: Number(form.cliente_id),
      caminhao_id: form.caminhao_id ? Number(form.caminhao_id) : null,
      tipo_cte: "0",
      cfop: form.cfop.trim(),
      natureza_operacao: form.natureza_operacao.trim(),
      dt_emissao: new Date(form.dt_emissao).toISOString(),
      servico: { valor_prestacao: num(form.valor_prestacao) ?? 0 },
      tomador: { cpf_cnpj: clienteSelecionado.cnpj_cpf },
    };
    if (Object.keys(carga).length) payload.carga = carga;
    if (form.chave_nfe_referenciada.replace(/\D/g, "").length)
      payload.chave_nfe_referenciada = form.chave_nfe_referenciada.replace(
        /\D/g,
        "",
      );
    if (form.rntrc.trim()) payload.modal = { rntrc: form.rntrc.replace(/\D/g, "") };

    onSubmit(payload);
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
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
            onChange={(e) => set("cfop", e.target.value)}
            placeholder="5353"
            required
            className="mb-0"
          />

          <FormField
            label="Natureza da operação"
            value={form.natureza_operacao}
            onChange={(e) => set("natureza_operacao", e.target.value)}
            placeholder="Prestação de serviço de transporte"
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

          <FormField
            label="Valor da prestação (serviço)"
            type="number"
            step="0.01"
            value={form.valor_prestacao}
            onChange={(e) => set("valor_prestacao", e.target.value)}
            placeholder="0,00"
            className="mb-0"
          />

          <FormField
            label="Valor da carga"
            type="number"
            step="0.01"
            value={form.valor_carga}
            onChange={(e) => set("valor_carga", e.target.value)}
            placeholder="0,00"
            className="mb-0"
          />

          <FormField
            label="Peso da carga (kg)"
            type="number"
            step="0.001"
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
            className="mb-0"
          />

          <FormField
            label="Chave da NF-e referenciada (opcional)"
            value={form.chave_nfe_referenciada}
            onChange={(e) => set("chave_nfe_referenciada", e.target.value)}
            placeholder="44 dígitos da NF-e transportada"
            maxLength={54}
            className="mb-0"
          />

          <FormField
            label="RNTRC (modal rodoviário)"
            value={form.rntrc}
            onChange={(e) => set("rntrc", e.target.value)}
            placeholder="Somente números"
            className="mb-0"
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            loading={submitting}
            disabled={
              !form.cliente_id ||
              !form.cfop.trim() ||
              !form.natureza_operacao.trim()
            }
          >
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
          <FormField
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
};
