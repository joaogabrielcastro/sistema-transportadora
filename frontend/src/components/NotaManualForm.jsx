import React, { useMemo, useState } from "react";
import { Button, Card, FormField, SearchableSelect } from "./ui";
import { formatCaminhaoOptions } from "../utils/caminhaoOptions.js";

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
});

export default function NotaManualForm({
  caminhoes = [],
  produtos = [],
  submitting = false,
  onSubmit,
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    emitente: "",
    cnpj_emitente: "",
    numero: "",
    serie: "1",
    data_emissao: today,
    data_vencimento: "",
    condicao_pagamento: "À vista",
    chave_acesso: "",
    observacao: "",
    caminhao_id: "",
  });
  const [itens, setItens] = useState([emptyItem()]);

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

  const totalNota = itens.reduce((acc, item) => acc + (itemTotal(item) || 0), 0);

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
        valor_total: itemTotal(item),
      })),
    });
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Cadastro manual da nota
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Use quando não houver XML. Os itens entram no estoque com o valor
            unitário informado, iguais à importação da NF-e.
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
            />
            <FormField
              label="CNPJ / CPF"
              name="cnpj_emitente"
              value={form.cnpj_emitente}
              onChange={(e) => setField("cnpj_emitente", e.target.value)}
              className="mb-0"
              placeholder="00.000.000/0000-00"
            />
            <FormField
              label="Número"
              name="numero"
              value={form.numero}
              onChange={(e) => setField("numero", e.target.value)}
              required
              className="mb-0"
            />
            <FormField
              label="Série"
              name="serie"
              value={form.serie}
              onChange={(e) => setField("serie", e.target.value)}
              className="mb-0"
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
              label="Chave NF-e"
              name="chave_acesso"
              value={form.chave_acesso}
              onChange={(e) => setField("chave_acesso", e.target.value)}
              className="mb-0 sm:col-span-2"
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
          <p className="text-sm font-semibold text-text-primary">
            Total da nota:{" "}
            {totalNota.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </section>

        <div className="flex justify-end">
          <Button type="submit" loading={submitting}>
            Cadastrar nota
          </Button>
        </div>
      </form>
    </Card>
  );
}
