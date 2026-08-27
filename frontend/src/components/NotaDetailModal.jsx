import React from "react";
import { Button, LoadingSpinner, Modal } from "./ui";
import NotaManualForm from "./NotaManualForm.jsx";

function formatMoney(value) {
  if (value == null || value === "") return "—";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function InfoItem({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-gray-50 px-3 py-2.5">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-text-primary break-words">
        {value || "—"}
      </p>
    </div>
  );
}

export default function NotaDetailModal({
  isOpen,
  onClose,
  nota,
  loading = false,
  editing = false,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  savingEdit = false,
  caminhoes = [],
  produtos = [],
}) {
  const caminhao = nota?.caminhoes;
  const placaLabel = caminhao
    ? `${caminhao.placa}${caminhao.modelo ? ` — ${caminhao.modelo}` : ""}`
    : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        editing
          ? `Editar nota ${nota?.numero || ""}${nota?.serie ? `/${nota.serie}` : ""}`
          : nota
            ? `Nota ${nota.numero}${nota.serie ? `/${nota.serie}` : ""}`
            : "Detalhe da nota"
      }
      size="xl"
    >
      {loading || !nota ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : editing ? (
        <NotaManualForm
          embedded
          mode="edit"
          initialNota={nota}
          caminhoes={caminhoes}
          produtos={produtos}
          submitting={savingEdit}
          onCancel={onCancelEdit}
          onSubmit={onSaveEdit}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <InfoItem
              label="Origem"
              value={
                nota.origem === "manual" ? "Cadastro manual" : "Importação XML"
              }
            />
            <InfoItem label="Emitente / Fornecedor" value={nota.emitente} />
            <InfoItem label="CNPJ / CPF" value={nota.cnpj_emitente} />
            <InfoItem
              label="Data de emissão"
              value={formatDate(nota.data_emissao)}
            />
            <InfoItem
              label="Data de vencimento"
              value={formatDate(nota.data_vencimento)}
            />
            <InfoItem
              label="Cond. pagamento"
              value={nota.condicao_pagamento}
            />
            <InfoItem
              label="Desconto"
              value={formatMoney(nota.valor_desconto)}
            />
            <InfoItem label="Frete" value={formatMoney(nota.valor_frete)} />
            <InfoItem label="IPI" value={formatMoney(nota.valor_ipi)} />
            <InfoItem label="Valor total" value={formatMoney(nota.valor_total)} />
            <InfoItem label="Veículo" value={placaLabel} />
            <InfoItem
              label="Cadastrada em"
              value={
                nota.criado_em
                  ? new Date(nota.criado_em).toLocaleString("pt-BR")
                  : "—"
              }
            />
            <InfoItem label="Chave NF-e" value={nota.chave_acesso} />
            <InfoItem label="Status" value={nota.status || "confirmada"} />
          </div>

          {nota.observacao ? (
            <div className="rounded-lg border border-border bg-white px-3 py-3">
              <p className="text-xs text-text-secondary">Observação</p>
              <p className="mt-1 text-sm text-text-primary whitespace-pre-wrap">
                {nota.observacao}
              </p>
            </div>
          ) : null}

          <div>
            <h4 className="mb-2 text-sm font-semibold text-text-primary">
              Itens ({nota.itens?.length || 0})
            </h4>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-text-secondary">
                    <th className="px-3 py-2.5 font-medium">Código</th>
                    <th className="px-3 py-2.5 font-medium">Descrição</th>
                    <th className="px-3 py-2.5 font-medium">Qtd</th>
                    <th className="px-3 py-2.5 font-medium">Un</th>
                    <th className="px-3 py-2.5 font-medium">Valor un.</th>
                    <th className="px-3 py-2.5 font-medium">Desc.</th>
                    <th className="px-3 py-2.5 font-medium">IPI</th>
                    <th className="px-3 py-2.5 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(nota.itens || []).map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {item.codigo || "—"}
                      </td>
                      <td className="px-3 py-2.5">{item.descricao}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {Number(item.quantidade)}
                      </td>
                      <td className="px-3 py-2.5">{item.unidade || "UN"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {formatMoney(item.valor_unitario)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {formatMoney(item.valor_desconto)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {formatMoney(item.valor_ipi)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium">
                        {formatMoney(
                          item.valor_total != null
                            ? item.valor_total
                            : Number(item.quantidade) *
                                Number(item.valor_unitario || 0),
                        )}
                      </td>
                    </tr>
                  ))}
                  {!(nota.itens || []).length && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-8 text-center text-text-secondary"
                      >
                        Nenhum item nesta nota.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
            {onStartEdit && (
              <Button type="button" onClick={onStartEdit}>
                Editar nota
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
