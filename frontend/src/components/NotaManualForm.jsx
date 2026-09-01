import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, FormField, SearchableSelect } from "./ui";
import { formatCaminhaoOptions } from "../utils/caminhaoOptions.js";
import { FIELD_LIMITS } from "../utils/fieldLimits.js";

function toInputDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function moneyStr(value) {
  if (value == null || value === "") return "";
  return String(value);
}

function itemTotal(item) {
  const q = Number(String(item.quantidade).replace(",", "."));
  const u = Number(String(item.valor_unitario).replace(",", "."));
  if (!Number.isFinite(q) || !Number.isFinite(u)) return null;
  return Math.round(q * u * 100) / 100;
}

const emptyItem = () => ({
  codigo: "",
  descricao: "",
  quantidade: "1",
  unidade: "UN",
  valor_unitario: "",
  valor_desconto: "",
  valor_ipi: "",
});

function notaToForm(nota) {
  return {
    emitente: nota?.emitente || "",
    cnpj_emitente: nota?.cnpj_emitente || "",
    numero: nota?.numero || "",
    serie: nota?.serie || "1",
    data_emissao: toInputDate(nota?.data_emissao) || new Date().toISOString().split("T")[0],
    data_vencimento: toInputDate(nota?.data_vencimento),
    condicao_pagamento: nota?.condicao_pagamento || "À vista",
    chave_acesso: nota?.chave_acesso || "",
    observacao: nota?.observacao || "",
    caminhao_id: nota?.caminhao_id ? String(nota.caminhao_id) : "",
    valor_desconto: moneyStr(nota?.valor_desconto),
    valor_frete: moneyStr(nota?.valor_frete),
    valor_ipi: moneyStr(nota?.valor_ipi),
  };
}

function notaToItens(nota) {
  if (!Array.isArray(nota?.itens) || !nota.itens.length) return [emptyItem()];
  return nota.itens.map((item) => ({
    codigo: item.codigo || "",
    descricao: item.descricao || "",
    quantidade: item.quantidade != null ? String(item.quantidade) : "1",
    unidade: item.unidade || "UN",
    valor_unitario:
      item.valor_unitario != null ? String(item.valor_unitario) : "",
    valor_desconto: moneyStr(item.valor_desconto),
    valor_ipi: moneyStr(item.valor_ipi),
  }));
}

function parseMoney(value) {
  if (value === "" || value == null) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default function NotaManualForm({
  caminhoes = [],
  produtos = [],
  submitting = false,
  onSubmit,
  onCancel,
  initialNota = null,
  mode = "create",
  embedded = false,
}) {
  const isEdit = mode === "edit";
  const [form, setForm] = useState(() => notaToForm(initialNota));
  const [itens, setItens] = useState(() => notaToItens(initialNota));

  useEffect(() => {
    if (!initialNota) return;
    setForm(notaToForm(initialNota));
    setItens(notaToItens(initialNota));
  }, [initialNota]);

  const caminhaoOptions = formatCaminhaoOptions(caminhoes);
  const produtoOptions = useMemo(
    () =>
      (Array.isArray(produtos) ? produtos : []).map((p) => ({
        value: String(p.id),
        label: `${p.descricao}${p.codigo ? ` (${p.codigo})` : ""}`,
        searchText: [p.codigo, p.descricao].filter(Boolean).join(" "),
      })),
    [produtos],
  );

  const itensSoma = itens.reduce((acc, item) => acc + (itemTotal(item) || 0), 0);
  const desconto = parseMoney(form.valor_desconto) || 0;
  const frete = parseMoney(form.valor_frete) || 0;
  const ipi = parseMoney(form.valor_ipi) || 0;
  const totalNota = Math.round((itensSoma - desconto + frete + ipi) * 100) / 100;

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const updateItem = (index, field, value) => {
    setItens((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const fillFromProduto = (index, produtoId) => {
    const produto = produtos.find((p) => String(p.id) === String(produtoId));
    if (!produto) return;
    setItens((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        codigo: produto.codigo || next[index].codigo,
        descricao: produto.descricao || next[index].descricao,
        unidade: produto.unidade || next[index].unidade || "UN",
        valor_unitario:
          produto.preco_custo != null
            ? String(produto.preco_custo)
            : next[index].valor_unitario,
      };
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      caminhao_id: form.caminhao_id || null,
      valor_desconto: parseMoney(form.valor_desconto),
      valor_frete: parseMoney(form.valor_frete),
      valor_ipi: parseMoney(form.valor_ipi),
      valor_total: totalNota,
      itens: itens.map((item) => ({
        codigo: item.codigo || null,
        descricao: item.descricao,
        unidade: item.unidade || "UN",
        quantidade: Number(String(item.quantidade).replace(",", ".")),
        valor_unitario:
          item.valor_unitario === ""
            ? null
            : Number(String(item.valor_unitario).replace(",", ".")),
        valor_desconto: parseMoney(item.valor_desconto),
        valor_ipi: parseMoney(item.valor_ipi),
        valor_total: itemTotal(item),
      })),
    });
  };

  const body = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-text-primary">
          {isEdit ? "Editar nota fiscal" : "Cadastro manual da nota"}
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          {isEdit
            ? "Corrija os dados e salve. O estoque é reconciliado com os itens desta nota."
            : "Use quando não houver XML. Informe também desconto, frete e IPI quando houver."}
        </p>
      </div>

      <section className="space-y-4">
        <h4 className="text-sm font-semibold text-text-primary">
          A. Dados gerais
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField
            label="Fornecedor"
            name="emitente"
            value={form.emitente}
            onChange={(e) => setField("emitente", e.target.value)}
            required
            className="mb-0 sm:col-span-2"
            placeholder="Razão social"
            maxLength={FIELD_LIMITS.EMITENTE}
          />
          <FormField
            label="CNPJ / CPF"
            name="cnpj_emitente"
            value={form.cnpj_emitente}
            onChange={(e) => setField("cnpj_emitente", e.target.value)}
            className="mb-0"
            mask="cpfCnpj"
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
          />
          <FormField
            label="Número"
            name="numero"
            value={form.numero}
            onChange={(e) => setField("numero", e.target.value)}
            required
            className="mb-0"
            maxLength={FIELD_LIMITS.NOTA_NUMERO}
          />
          <FormField
            label="Série"
            name="serie"
            value={form.serie}
            onChange={(e) => setField("serie", e.target.value)}
            className="mb-0"
            maxLength={FIELD_LIMITS.NOTA_SERIE}
          />
          <FormField
            label="Data de emissão"
            type="date"
            name="data_emissao"
            value={form.data_emissao}
            onChange={(e) => setField("data_emissao", e.target.value)}
            required
            className="mb-0"
          />
          <FormField
            label="Data de vencimento"
            type="date"
            name="data_vencimento"
            value={form.data_vencimento}
            onChange={(e) => setField("data_vencimento", e.target.value)}
            className="mb-0"
          />
          <FormField
            label="Cond. pagamento"
            type="select"
            name="condicao_pagamento"
            value={form.condicao_pagamento}
            onChange={(e) => setField("condicao_pagamento", e.target.value)}
            className="mb-0"
            options={[
              { value: "À vista", label: "À vista" },
              { value: "7 dias", label: "7 dias" },
              { value: "15 dias", label: "15 dias" },
              { value: "30 dias", label: "30 dias" },
              { value: "45 dias", label: "45 dias" },
              { value: "60 dias", label: "60 dias" },
            ]}
          />
          <FormField
            label="Desconto (R$)"
            type="number"
            step="0.01"
            min="0"
            name="valor_desconto"
            value={form.valor_desconto}
            onChange={(e) => setField("valor_desconto", e.target.value)}
            className="mb-0"
            placeholder="0,00"
          />
          <FormField
            label="Frete (R$)"
            type="number"
            step="0.01"
            min="0"
            name="valor_frete"
            value={form.valor_frete}
            onChange={(e) => setField("valor_frete", e.target.value)}
            className="mb-0"
            placeholder="0,00"
          />
          <FormField
            label="IPI (R$)"
            type="number"
            step="0.01"
            min="0"
            name="valor_ipi"
            value={form.valor_ipi}
            onChange={(e) => setField("valor_ipi", e.target.value)}
            className="mb-0"
            placeholder="0,00"
          />
          <FormField
            label="Chave NF-e"
            name="chave_acesso"
            value={form.chave_acesso}
            onChange={(e) => setField("chave_acesso", e.target.value)}
            className="mb-0 sm:col-span-2"
            mask="chaveNfe"
            inputMode="numeric"
            placeholder="Opcional — 44 dígitos"
          />
          <SearchableSelect
            label="Veículo (opcional)"
            value={form.caminhao_id}
            onChange={(value) => setField("caminhao_id", value)}
            options={caminhaoOptions}
            placeholder="Placa do caminhão..."
            allowEmpty
            emptyLabel="Estoque geral"
            helperText="Se informar, as peças ficam ligadas a este veículo no estoque."
            className="mb-0 sm:col-span-2"
          />
          <FormField
            label="Observação"
            type="textarea"
            name="observacao"
            value={form.observacao}
            onChange={(e) => setField("observacao", e.target.value)}
            rows={2}
            className="mb-0 sm:col-span-2 lg:col-span-4"
            maxLength={FIELD_LIMITS.OBSERVACAO}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-text-primary">
            Itens da nota
          </h4>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setItens((prev) => [...prev, emptyItem()])}
          >
            + Item
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-text-secondary">
                <th className="px-3 py-2.5 font-medium">Peça cadastrada</th>
                <th className="px-3 py-2.5 font-medium">Código</th>
                <th className="px-3 py-2.5 font-medium">Descrição *</th>
                <th className="px-3 py-2.5 font-medium">Qtd *</th>
                <th className="px-3 py-2.5 font-medium">Un</th>
                <th className="px-3 py-2.5 font-medium">Vl. unit. *</th>
                <th className="px-3 py-2.5 font-medium">Desc.</th>
                <th className="px-3 py-2.5 font-medium">IPI</th>
                <th className="px-3 py-2.5 font-medium">Total</th>
                <th className="px-3 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {itens.map((item, idx) => (
                <tr key={idx} className="border-t border-border align-top">
                  <td className="px-3 py-2 min-w-[12rem]">
                    <SearchableSelect
                      value=""
                      onChange={(value) => fillFromProduto(idx, value)}
                      options={produtoOptions}
                      placeholder="Buscar no estoque…"
                      allowEmpty
                      emptyLabel="Peça nova"
                      className="mb-0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-28 rounded-md border border-border px-2 py-1.5"
                      value={item.codigo}
                      maxLength={FIELD_LIMITS.CODIGO_PRODUTO}
                      onChange={(e) =>
                        updateItem(idx, "codigo", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full min-w-[12rem] rounded-md border border-border px-2 py-1.5"
                      value={item.descricao}
                      required
                      maxLength={FIELD_LIMITS.DESCRICAO}
                      onChange={(e) =>
                        updateItem(idx, "descricao", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      required
                      className="w-24 rounded-md border border-border px-2 py-1.5"
                      value={item.quantidade}
                      onChange={(e) =>
                        updateItem(idx, "quantidade", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-16 rounded-md border border-border px-2 py-1.5"
                      value={item.unidade}
                      maxLength={FIELD_LIMITS.UNIDADE}
                      onChange={(e) =>
                        updateItem(idx, "unidade", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className="w-28 rounded-md border border-border px-2 py-1.5"
                      value={item.valor_unitario}
                      onChange={(e) =>
                        updateItem(idx, "valor_unitario", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-24 rounded-md border border-border px-2 py-1.5"
                      value={item.valor_desconto}
                      onChange={(e) =>
                        updateItem(idx, "valor_desconto", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-24 rounded-md border border-border px-2 py-1.5"
                      value={item.valor_ipi}
                      onChange={(e) =>
                        updateItem(idx, "valor_ipi", e.target.value)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">
                    {itemTotal(item) != null
                      ? itemTotal(item).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {itens.length > 1 && (
                      <button
                        type="button"
                        className="text-xs font-medium text-danger hover:underline"
                        onClick={() =>
                          setItens((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                      >
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-1 text-sm text-text-secondary">
          <p>
            Soma dos itens:{" "}
            {itensSoma.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
          <p className="font-semibold text-text-primary">
            Total da nota (itens − desconto + frete + IPI):{" "}
            {totalNota.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {isEdit ? "Salvar alterações" : "Cadastrar nota"}
        </Button>
      </div>
    </form>
  );

  if (embedded) return body;
  return <Card className="p-6">{body}</Card>;
}
