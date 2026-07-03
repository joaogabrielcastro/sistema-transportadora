import React from "react";
import { Button, Modal } from "./ui";

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  warning = false,
  dependencias = null,
}) => {
  const loading = Boolean(confirmText?.includes("Excluindo"));

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? undefined : onClose}
      title={title}
      size="md"
      showCloseButton={!loading}
      closeOnOverlayClick={!loading}
      closeOnEscape={!loading}
    >
      <div
        className={`flex items-start gap-3 mb-4 ${
          warning ? "text-danger" : "text-primary"
        }`}
      >
        {warning ? (
          <div className="p-2 bg-red-50 rounded-full shrink-0">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
        ) : (
          <div className="p-2 bg-blue-50 rounded-full shrink-0">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        )}
        <p className="text-text-secondary leading-relaxed pt-1">{message}</p>
      </div>

      {dependencias && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-amber-800 mb-2">Registros vinculados</h4>
          <ul className="text-sm text-amber-700 space-y-1 ml-6 list-disc">
            {dependencias.total_gastos > 0 && (
              <li>{dependencias.total_gastos} gastos</li>
            )}
            {dependencias.total_checklists > 0 && (
              <li>{dependencias.total_checklists} manutenções</li>
            )}
            {dependencias.total_pneus > 0 && (
              <li>{dependencias.total_pneus} pneus</li>
            )}
            {dependencias.documentos > 0 && (
              <li>{dependencias.documentos} documentos</li>
            )}
            {dependencias.ordens_envio > 0 && (
              <li>{dependencias.ordens_envio} ordens de coleta</li>
            )}
            {dependencias.total_viagens > 0 && (
              <li>{dependencias.total_viagens} viagens</li>
            )}
          </ul>
          <p className="text-xs text-amber-600 mt-3 font-medium">
            Delete primeiro esses registros antes de excluir o caminhão.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          {cancelText || "Cancelar"}
        </Button>
        <Button
          variant={warning ? "danger" : "primary"}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmText || "Confirmar"}
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
