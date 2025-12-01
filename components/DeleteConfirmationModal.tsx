import React, { useState } from 'react';
import { AlertTriangle, Trash2, RefreshCw, X } from 'lucide-react';

export type DeleteItemType = 'Interveniente' | 'Tipo de Documento' | 'Facto';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: DeleteItemType;
  itemName: string;
  usageCount: number;
  availableReplacements: string[];
  onConfirmDelete: () => void;
  onConfirmReplace: (replacementName: string) => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  itemType,
  itemName,
  usageCount,
  availableReplacements,
  onConfirmDelete,
  onConfirmReplace
}) => {
  const [replacement, setReplacement] = useState('');

  if (!isOpen) return null;

  const handleReplace = () => {
    if (replacement) {
      onConfirmReplace(replacement);
      setReplacement('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex items-center gap-3">
          <div className="bg-orange-100 p-2 rounded-full">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">Item em uso</h3>
            <p className="text-xs text-orange-700 font-medium">Ação necessária</p>
          </div>
        </div>

        <div className="p-6">
          <p className="text-gray-600 text-sm mb-4">
            O item <strong>"{itemName}"</strong> ({itemType}) está atualmente associado a <strong className="text-gray-900">{usageCount} documento(s)</strong>.
          </p>
          <p className="text-gray-600 text-sm mb-6">
            Não pode ser eliminado diretamente sem afetar a organização. O que deseja fazer?
          </p>

          {/* Option A: Replace */}
          <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h4 className="text-sm font-bold text-blue-800 mb-2 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Opção A: Substituir
            </h4>
            <p className="text-xs text-blue-600 mb-3">
              Escolha outro item para substituir "{itemName}" em todos os documentos.
            </p>
            
            <div className="flex gap-2">
              <select
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                className="flex-1 text-sm border border-blue-200 rounded px-2 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione substituto...</option>
                {availableReplacements.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <button
                onClick={handleReplace}
                disabled={!replacement}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded font-medium transition-colors"
              >
                Substituir
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <div className="h-px bg-gray-200 flex-1"></div>
            <span className="text-xs text-gray-400 font-bold uppercase">OU</span>
            <div className="h-px bg-gray-200 flex-1"></div>
          </div>

          {/* Option B: Delete Forcefully */}
          <div className="flex flex-col gap-3">
             <button
               onClick={onConfirmDelete}
               className="w-full flex items-center justify-center gap-2 border border-red-200 bg-white hover:bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
             >
               <Trash2 className="w-4 h-4" />
               Eliminar de todos os documentos
             </button>
             
             <button
               onClick={onClose}
               className="w-full text-gray-500 hover:text-gray-800 text-sm py-2 hover:underline"
             >
               Cancelar
             </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
