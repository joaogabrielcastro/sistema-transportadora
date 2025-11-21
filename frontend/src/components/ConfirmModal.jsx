import React from "react";
import { Button } from "./ui";

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-scale-in overflow-hidden">
        <div className="p-6">
          <div
            className={`flex items-center mb-4 ${
              warning ? "text-danger" : "text-primary"
            }`}
          >
            {warning ? (
              <div className="p-2 bg-red-50 rounded-full mr-3">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
              <div className="p-2 bg-blue-50 rounded-full mr-3">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
            <h3 className="text-lg font-bold text-text-primary">{title}</h3>
          </div>

          <p className="text-text-secondary mb-4 leading-relaxed">{message}</p>

          {dependencias && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-amber-800 mb-2 flex items-center">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Registros Vinculados:
              </h4>
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
                {dependencias.total_viagens > 0 && (
                  <li>{dependencias.total_viagens} viagens</li>
                )}
              </ul>
              <p className="text-xs text-amber-600 mt-3 font-medium">
                Delete primeiro esses registros antes de excluir o caminhão.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={confirmText?.includes("Excluindo")}
            >
              {cancelText || "Cancelar"}
            </Button>
            <Button
              variant={warning ? "danger" : "primary"}
              onClick={onConfirm}
              loading={confirmText?.includes("Excluindo")}
            >
              {confirmText || "Confirmar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
