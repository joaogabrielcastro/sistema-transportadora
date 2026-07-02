import React, { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "../hooks";
import { extractApiArray } from "../utils/extractApiArray.js";
import ConfirmModal from "./ConfirmModal";
import { Button } from "./ui";

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const CaminhaoDocumentos = ({ placa }) => {
  const { get, request, delete: del, loading } = useApi();
  const [documentos, setDocumentos] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef(null);

  const carregar = useCallback(async () => {
    if (!placa) return;
    setCarregandoLista(true);
    try {
      const res = await get(`/caminhoes/${placa}/documentos`, {
        skipSuccessToast: true,
      });
      setDocumentos(extractApiArray(res));
    } catch {
      setDocumentos([]);
    } finally {
      setCarregandoLista(false);
    }
  }, [get, placa]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirPdf = async (doc) => {
    if (doc.arquivo_disponivel === false) {
      window.alert(
        "O arquivo deste PDF não está mais no servidor (comum após redeploy sem volume em /app/uploads). Remova o item e envie o PDF novamente.",
      );
      return;
    }

    try {
      const res = await request({
        method: "GET",
        url: `/caminhoes/${placa}/documentos/${doc.id}/arquivo`,
        responseType: "blob",
        skipSuccessToast: true,
      });
      const blob =
        res?.data instanceof Blob
          ? res.data
          : new Blob([res?.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      /* toast do useApi */
    }
  };

  const handleUpload = async (event) => {
    const files = event.target.files;
    if (!files?.length) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("arquivos", file));

    try {
      await request({
        method: "POST",
        url: `/caminhoes/${placa}/documentos`,
        data: formData,
      });
      await carregar();
    } finally {
      event.target.value = "";
    }
  };

  const handleRemoverClick = (doc) => {
    setDeleteTarget(doc);
  };

  const confirmRemover = async () => {
    if (!deleteTarget) return;

    setRemoving(true);
    try {
      await del(`/caminhoes/${placa}/documentos/${deleteTarget.id}`);
      setDeleteTarget(null);
      await carregar();
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Anexe PDFs obrigatórios (CRLV, seguro, ANTT, etc.). Máx. 15 MB por
          arquivo, até 30 por caminhão.
        </p>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            variant="secondary"
            loading={loading}
            onClick={() => inputRef.current?.click()}
          >
            Adicionar PDFs
          </Button>
        </div>
      </div>

      {carregandoLista ? (
        <p className="text-sm text-text-light">Carregando documentos…</p>
      ) : documentos.length === 0 ? (
        <p className="text-sm text-text-secondary py-6 text-center border border-dashed border-border rounded-lg">
          Nenhum PDF anexado. Use &quot;Adicionar PDFs&quot; para enviar os
          documentos deste veículo.
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {documentos.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary truncate">
                  {doc.nome_original}
                </p>
                <p className="text-xs text-text-light mt-0.5">
                  {formatBytes(doc.tamanho_bytes)}
                  {doc.criado_em &&
                    ` · ${new Date(doc.criado_em).toLocaleString("pt-BR")}`}
                </p>
                {doc.arquivo_disponivel === false && (
                  <p className="text-xs text-amber-700 mt-1">
                    Arquivo ausente no servidor — remova e envie o PDF novamente.
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={doc.arquivo_disponivel === false}
                  onClick={() => abrirPdf(doc)}
                >
                  Abrir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={loading}
                  onClick={() => handleRemoverClick(doc)}
                  className="text-danger border-danger/30 hover:bg-red-50"
                >
                  Remover
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !removing && setDeleteTarget(null)}
        onConfirm={confirmRemover}
        title="Remover documento"
        message={
          deleteTarget
            ? `Remover o documento "${deleteTarget.nome_original}"? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmText={removing ? "Removendo..." : "Remover"}
        cancelText="Cancelar"
        warning
      />
    </div>
  );
};

export default CaminhaoDocumentos;
