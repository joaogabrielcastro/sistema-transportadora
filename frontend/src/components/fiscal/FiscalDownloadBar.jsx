import React from "react";
import PropTypes from "prop-types";
import { Button } from "../ui";
import { rotuloSelecao } from "../../utils/fiscalDownload.js";

/**
 * Barra de ação fixa no rodapé — aparece quando há >= 1 documento fiscal
 * selecionado na lista. Contador + "Baixar selecionados" (zip do lote) +
 * "Limpar seleção". Só ADICIONA: não altera nada da tela.
 */
export default function FiscalDownloadBar({
  quantidade = 0,
  baixando = false,
  onBaixar,
  onLimpar,
}) {
  if (!quantidade || quantidade < 1) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-primary">
          {rotuloSelecao(quantidade)}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onLimpar}
            disabled={baixando}
          >
            Limpar seleção
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onBaixar}
            loading={baixando}
            loadingText="Preparando zip…"
          >
            Baixar selecionados
          </Button>
        </div>
      </div>
    </div>
  );
}

FiscalDownloadBar.propTypes = {
  quantidade: PropTypes.number,
  baixando: PropTypes.bool,
  onBaixar: PropTypes.func,
  onLimpar: PropTypes.func,
};
