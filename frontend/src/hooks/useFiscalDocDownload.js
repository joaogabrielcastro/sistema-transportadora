import { useCallback, useState } from "react";
import { saveAs } from "file-saver";
import { useApi } from "./useApi.js";
import { useToast } from "../components/ui/useToast.js";
import {
  LIMITE_DOWNLOAD_LOTE,
  nomeArquivoDoc,
  nomeArquivoLote,
  urlDownloadDoc,
  urlDownloadLote,
} from "../utils/fiscalDownload.js";

/**
 * Baixa CT-e/MDF-e autorizados: PDF/XML individual ou um zip em lote. SÓ ADICIONA
 * comportamento — usa as rotas novas `GET /fiscal/:tipo/:id/{pdf,xml}` e
 * `POST /fiscal/:tipo/download-lote`. O `parseApiError` do apiClient já
 * desempacota o JSON de erro mesmo quando a resposta veio como blob.
 *
 * @param {"cte"|"mdfe"} tipo
 */
export function useFiscalDocDownload(tipo) {
  const { request } = useApi();
  const toast = useToast();
  const [baixando, setBaixando] = useState(false);

  const baixarIndividual = useCallback(
    async (row, formato) => {
      if (!row?.id) return;
      setBaixando(true);
      try {
        const res = await request({
          method: "GET",
          url: urlDownloadDoc(tipo, row.id, formato),
          responseType: "blob",
          skipErrorToast: true,
        });
        const blob =
          res?.data instanceof Blob
            ? res.data
            : new Blob([res?.data], {
                type:
                  formato === "pdf" ? "application/pdf" : "application/xml",
              });
        saveAs(blob, nomeArquivoDoc(row.chave_acesso, formato));
      } catch (err) {
        toast.error(
          err?.message ||
            `Não foi possível baixar o ${String(formato).toUpperCase()} do documento.`,
        );
      } finally {
        setBaixando(false);
      }
    },
    [request, toast, tipo],
  );

  const baixarLote = useCallback(
    async (ids) => {
      const lista = Array.from(new Set((ids || []).map(Number))).filter(
        (n) => Number.isInteger(n) && n > 0,
      );
      if (lista.length === 0) return;
      if (lista.length > LIMITE_DOWNLOAD_LOTE) {
        toast.error(
          `Selecione no máximo ${LIMITE_DOWNLOAD_LOTE} documentos por vez — filtre mais e tente de novo.`,
        );
        return;
      }
      setBaixando(true);
      try {
        const res = await request({
          method: "POST",
          url: urlDownloadLote(tipo),
          data: { ids: lista },
          responseType: "blob",
          skipErrorToast: true,
          timeout: 120_000,
        });
        const blob =
          res?.data instanceof Blob
            ? res.data
            : new Blob([res?.data], { type: "application/zip" });
        saveAs(blob, nomeArquivoLote(tipo));
      } catch (err) {
        toast.error(
          err?.message ||
            "Não foi possível baixar os documentos selecionados.",
        );
      } finally {
        setBaixando(false);
      }
    },
    [request, toast, tipo],
  );

  return { baixarIndividual, baixarLote, baixando };
}
