import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Alert, Button, FormField, Modal } from "../ui";

const MIN = 15;
const MAX = 1000;

/**
 * Modal de justificativa de cancelamento, reutilizado por CT-e e MDF-e.
 * A regra 15..1000 caracteres espelha `cancelarDocumentoSchema` no backend.
 */
export default function CancelarDocModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  titulo = "Cancelar documento",
  descricao,
}) {
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (isOpen) {
      setJustificativa("");
      setErro("");
    }
  }, [isOpen]);

  const len = justificativa.trim().length;
  const invalido = len < MIN || len > MAX;

  const handleConfirm = async () => {
    if (invalido) {
      setErro(`A justificativa deve ter entre ${MIN} e ${MAX} caracteres.`);
      return;
    }
    setErro("");
    await onConfirm(justificativa.trim());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titulo} size="md">
      <div className="space-y-4">
        {descricao && (
          <p className="text-sm text-text-secondary">{descricao}</p>
        )}
        {erro && <Alert type="error" message={erro} />}
        <FormField
          label="Justificativa"
          type="textarea"
          rows={4}
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
          placeholder="Descreva o motivo do cancelamento (mínimo 15 caracteres)"
          helperText={`${len}/${MAX} caracteres`}
          required
          className="mb-0"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Voltar
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            loading={loading}
            disabled={invalido}
          >
            Confirmar cancelamento
          </Button>
        </div>
      </div>
    </Modal>
  );
}

CancelarDocModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  titulo: PropTypes.string,
  descricao: PropTypes.string,
};
