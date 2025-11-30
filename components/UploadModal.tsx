import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, Search } from 'lucide-react';
import { DocCategory } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, category: DocCategory, name: string, volume: string) => void;
  existingApensos: string[];
  existingAnexos: string[];
  availableFiles?: File[]; // Files found in the root folder
}

const UploadModal: React.FC<UploadModalProps> = ({ 
  isOpen, 
  onClose, 
  onUpload,
  existingApensos,
  existingAnexos,
  availableFiles = []
}) => {
  const [category, setCategory] = useState<DocCategory>('Autos Principais');
  const [customName, setCustomName] = useState('');
  const [volume, setVolume] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [mode, setMode] = useState<'root' | 'manual'>(availableFiles.length > 0 ? 'root' : 'manual');

  // Update creation mode when category changes
  useEffect(() => {
    const list = category === 'Apenso' ? existingApensos : (category === 'Anexo' ? existingAnexos : []);
    
    // If we have existing items, default to selection mode and pick the first one
    if (list.length > 0) {
      setIsCreatingNew(false);
      setCustomName(list[0]);
    } else {
      // If no items exist, force creation mode
      setIsCreatingNew(true);
      setCustomName('');
    }
  }, [category, existingApensos, existingAnexos]);

  // Update mode if available files change (e.g. root folder loaded)
  useEffect(() => {
    if (availableFiles.length > 0 && mode === 'manual' && !selectedFile) {
      setMode('root');
    }
  }, [availableFiles.length]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile && volume) {
      onUpload(selectedFile, category, customName, volume);
      // Reset fields
      setCustomName('');
      setVolume('');
      setSelectedFile(null);
      setCategory('Autos Principais');
      setSearchTerm('');
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (e.target.files[0].type === 'application/pdf' || e.target.files[0].name.toLowerCase().endsWith('.pdf')) {
        setSelectedFile(e.target.files[0]);
      } else {
        alert("Por favor selecione apenas ficheiros PDF.");
      }
    }
  };

  const handleSelectFromRoot = (file: File) => {
    setSelectedFile(file);
    // Try to guess volume from filename if possible
    const volMatch = file.name.match(/vol.*?(\d+)/i) || file.name.match(/(\d+)/);
    if (volMatch && !volume) {
      setVolume(volMatch[1]);
    }
  };

  const existingList = category === 'Apenso' ? existingApensos : existingAnexos;
  
  const filteredAvailableFiles = availableFiles.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.webkitRelativePath.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Adicionar Novo Ficheiro
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Processo</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value as DocCategory)}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="Autos Principais">Autos Principais</option>
                <option value="Apenso">Apenso</option>
                <option value="Anexo">Anexo</option>
              </select>
            </div>

            {/* Name for Apenso/Anexo */}
            {category !== 'Autos Principais' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Nome do {category}
                  </label>
                  
                  {existingList.length > 0 && (
                    <div className="flex text-xs bg-gray-100 p-0.5 rounded-md">
                        <button 
                          type="button"
                          onClick={() => setIsCreatingNew(false)}
                          className={`px-2 py-0.5 rounded transition-all ${!isCreatingNew ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Existente
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setIsCreatingNew(true); setCustomName(''); }}
                          className={`px-2 py-0.5 rounded transition-all ${isCreatingNew ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Novo
                        </button>
                    </div>
                  )}
                </div>

                {!isCreatingNew && existingList.length > 0 ? (
                  <select 
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {existingList.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    required
                    placeholder={`Ex: ${category} A`}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    autoFocus={isCreatingNew}
                  />
                )}
              </div>
            )}

            {/* Volume */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Volume</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Vol I, ou 1"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* File Selection Tabs */}
            <div className="mt-4">
              <div className="flex border-b border-gray-200 mb-2">
                 <button 
                   type="button"
                   onClick={() => setMode('root')}
                   disabled={availableFiles.length === 0}
                   className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mode === 'root' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'} ${availableFiles.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                 >
                   Da Pasta Principal
                 </button>
                 <button 
                   type="button"
                   onClick={() => setMode('manual')}
                   className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mode === 'manual' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                 >
                   Upload Manual
                 </button>
              </div>

              {mode === 'root' ? (
                <div className="border rounded-lg p-2 bg-gray-50 max-h-[200px] flex flex-col">
                   <div className="flex items-center bg-white border rounded px-2 mb-2 sticky top-0">
                      <Search className="w-4 h-4 text-gray-400" />
                      <input 
                        type="text"
                        placeholder="Pesquisar ficheiro..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 text-sm outline-none"
                      />
                   </div>
                   <div className="overflow-y-auto flex-1 space-y-1">
                      {filteredAvailableFiles.map((file, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectFromRoot(file)}
                          className={`w-full text-left text-xs p-2 rounded truncate ${selectedFile === file ? 'bg-blue-100 text-blue-700 font-semibold' : 'hover:bg-gray-200 text-gray-700'}`}
                          title={file.webkitRelativePath || file.name}
                        >
                           {file.webkitRelativePath || file.name}
                        </button>
                      ))}
                      {filteredAvailableFiles.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">Nenhum ficheiro encontrado.</p>
                      )}
                   </div>
                   {selectedFile && (
                     <div className="mt-2 text-xs text-green-600 font-semibold flex items-center gap-1">
                       <FileText className="w-3 h-3" />
                       Selecionado: {selectedFile.name}
                     </div>
                   )}
                </div>
              ) : (
                /* Manual Upload */
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-blue-50 transition-colors cursor-pointer relative">
                  <input 
                    type="file" 
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {selectedFile ? (
                    <div className="flex flex-col items-center text-blue-600">
                      <FileText className="w-10 h-10 mb-2" />
                      <span className="text-sm font-medium text-center break-all">{selectedFile.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-gray-500">
                      <Upload className="w-8 h-8 mb-2" />
                      <span className="text-sm">Clique para escolher o PDF</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={!selectedFile || !volume || (category !== 'Autos Principais' && !customName)}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg shadow transition-all transform active:scale-95"
            >
              Carregar Ficheiro
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;