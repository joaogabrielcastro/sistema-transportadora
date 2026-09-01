import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Button, FormField, Modal } from "../ui";

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const num = (v) => {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Formulário reduzido para emitir um CT-e de Complemento de Valores (tipo "1")
 * ou Substituto (tipo "3") referenciando um CT-e já emitido. A referência ao
 * CT-e da linha (`cte_referenciado_id`) e o cliente/tomador já vêm preenchidos.
 * Usa o mesmo endpoint POST /fiscal/cte/emitir.
 */
export default function CteReferenciaModal({
  isOpen,
  onClose,
  modo = "complemento",
  cte = null,
  clientes = [],
  submitting = false,
  onSubmit,
}) {
  const ehComplemento = modo === "complemento";
  const titulo = ehComplemento
    ? "Gerar CT-e de Complemento de Valores"
    : "Emitir CT-e Substituto";

  const cliente = useMemo(
    () => clientes.find((c) => String(c.id) === String(cte?.cliente_id)) || null,
    [clientes, cte],
  );

  const [form, setForm] = useState({
    cfop: "",
    natureza_operacao: "",
    dt_emissao: nowLocalInput(),
    valor_prestacao: "",
    valor_carga: "",
    peso: "",
    chave_nfe_referenciada: "",
  });
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      cfop: "",
      natureza_operacao: ehComplemento
        ? `Complemento de valores do CT-e ${cte?.numero || cte?.id || ""}`.trim()
        : `Substituição do CT-e ${cte?.numero || cte?.id || ""}`.trim(),
      dt_emissao: nowLocalInput(),
      valor_prestacao: "",
      valor_carga: "",
      peso: "",
      chave_nfe_referenciada: "",
    });
  }, [isOpen, modo, cte, ehComplemento]);

  const valorPrestacao = num(form.valor_prestacao);
  const invalido =
    !cte ||
    !cliente ||
    !form.cfop.trim() ||
    !form.natureza_operacao.trim() ||
    !(valorPrestacao > 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (invalido) return;

    const payload = {
      cliente_id: Number(cte.cliente_id),
      tipo_cte: ehComplemento ? "1" : "3",
      cte_referenciado_id: Number(cte.id),
      cfop: form.cfop.trim(),
      natureza_operacao: form.natureza_operacao.trim(),
      dt_emissao: new Date(form.dt_emissao).toISOString(),
      servico: { valor_prestacao: valorPrestacao },
      tomador: { cpf_cnpj: cliente.cnpj_cpf },
    };

    if (!ehComplemento) {
      const carga = {};
      if (num(form.valor_carga) != null) carga.valor_carga = num(form.valor_carga);
      if (num(form.peso) != null) carga.peso = num(form.peso);
      if (Object.keys(carga).length) payload.carga = carga;
      const chave = form.chave_nfe_referenciada.replace(/\D/g, "");
      if (chave.length) payload.chave_nfe_referenciada = chave;
    }

    onSubmit(payload);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titulo} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Alert
          type="info"
          message={
            `Referenciando o CT-e ${
              [cte?.numero, cte?.serie].filter(Boolean).join("/") ||
              `#${cte?.id ?? "—"}`
            }` +
            (cte?.chave_acesso ? ` — chave ${cte.chave_acesso}` : "") +
            (cliente ? ` · Tomador: ${cliente.razao_social}` : "")
          }
        />
        {!cliente && (
          <Alert
            type="error"
            message="Cliente/tomador do CT-e original não encontrado na lista — recarregue a página."
          />
        )}

        {ehComplemento && (
          <p className="text-sm text-text-secondary">
            O Complemento carrega apenas o valor adicional da prestação. Os
            demais dados são herdados do CT-e original pela SEFAZ.
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="CFOP"
            value={form.cfop}
            onChange={(e) => set("cfop", e.target.value)}
            placeholder="5353"
            required
            className="mb-0"
          />
          <FormField
            label={ehComplemento ? "Valor adicional (prestação)" : "Valor da prestação"}
            type="number"
            step="0.01"
            value={form.valor_prestacao}
            onChange={(e) => set("valor_prestacao", e.target.value)}
            placeholder="0,00"
            required
            className="mb-0"
          />
          <FormField
            label="Natureza da operação"
            value={form.natureza_operacao}
            onChange={(e) => set("natureza_operacao", e.target.value)}
            required
            className="mb-0 md:col-span-2"
          />
          <FormField
            label="Data/hora de emissão"
            type="datetime-local"
            value={form.dt_emissao}
            onChange={(e) => set("dt_emissao", e.target.value)}
            required
            className="mb-0"
          />

          {!ehComplemento && (
            <>
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
                label="Chave da NF-e referenciada (opcional)"
                value={form.chave_nfe_referenciada}
                onChange={(e) => set("chave_nfe_referenciada", e.target.value)}
                placeholder="44 dígitos"
                maxLength={54}
                className="mb-0"
              />
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting} disabled={invalido}>
            {ehComplemento ? "Gerar complemento" : "Emitir substituto"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

CteReferenciaModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  modo: PropTypes.oneOf(["complemento", "substituto"]),
  cte: PropTypes.object,
  clientes: PropTypes.array,
  submitting: PropTypes.bool,
  onSubmit: PropTypes.func.isRequired,
};
