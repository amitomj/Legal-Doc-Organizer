import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface GenericConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  isDestructive?: boolean;
}

const GenericConfirmModal: React.FC<GenericConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar",
  isDestructive = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[120] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-full ${isDestructive ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 leading-tight">
              {title}
            </h3>
          </div>
          
          <div className="text-gray-600 text-sm mb-6 whitespace-pre-wrap">
            {message}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className={`flex-1 px-4 py-2 text-white rounded-lg font-bold shadow-sm transition-colors ${
                isDestructive 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenericConfirmModal;