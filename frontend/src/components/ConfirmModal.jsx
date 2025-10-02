import React from 'react';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText, 
  cancelText, 
  warning = false,
  dependencias = null
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className={`flex items-center mb-4 ${warning ? 'text-red-600' : 'text-navy-blue'}`}>
            {warning ? (
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          
          <p className="text-gray-700 mb-4">{message}</p>
          
          {dependencias && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-yellow-800 mb-2">Registros Vinculados:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {dependencias.total_gastos > 0 && <li>• {dependencias.total_gastos} gastos</li>}
                {dependencias.total_checklists > 0 && <li>• {dependencias.total_checklists} manutenções</li>}
                {dependencias.total_pneus > 0 && <li>• {dependencias.total_pneus} pneus</li>}
                {dependencias.total_viagens > 0 && <li>• {dependencias.total_viagens} viagens</li>}
              </ul>
              <p className="text-xs text-yellow-600 mt-2">
                Delete primeiro esses registros antes de excluir o caminhão.
              </p>
            </div>
          )}
          
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={confirmText?.includes("Excluindo")}
            >
              {cancelText || "Cancelar"}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-white rounded-lg transition-colors ${
                warning 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-navy-blue hover:bg-blue-800'
              }`}
              disabled={confirmText?.includes("Excluindo")}
            >
              {confirmText || "Confirmar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;