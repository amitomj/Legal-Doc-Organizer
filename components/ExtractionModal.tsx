import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, User, UserPlus, Pencil, X as CloseIcon, ClipboardList, Move, Monitor, Minimize2, List, Trash2, Search, Settings } from 'lucide-react';
import { ExtractionMeta, Person, PersonType, OnConfirmExtraction } from '../types';

interface ExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: OnConfirmExtraction;
  pageRange: { start: number; end: number };
  people: Person[];
  onAddPerson: (name: string, type: PersonType) => void;
  onBulkAddPeople: (names: string[], type: PersonType) => void;
  onUpdatePerson: (id: string, name: string, type?: PersonType) => void;
  onDeletePerson: (id: string) => void;
  docTypes: string[];
  onAddDocType: (type: string) => void;
  onBulkAddDocTypes: (types: string[]) => void;
  onDeleteDocType: (type: string) => void;
  facts: string[];
  onAddFact: (fact: string) => void;
  onBulkAddFacts: (facts: string[]) => void;
  onDeleteFact: (fact: string) => void;
  initialData?: ExtractionMeta | null; // New prop for editing mode
}

// --- POPOUT WINDOW COMPONENT ---
interface PopoutWindowProps {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  onDock: () => void;
}

const PopoutWindow: React.FC<PopoutWindowProps> = ({ children, title, onClose, onDock }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const windowRef = useRef<Window | null>(null);

  useEffect(() => {
    // Open new native window
    const win = window.open('', '', 'width=900,height=850,left=100,top=100,resizable=yes,scrollbars=yes,status=yes');
    if (!win) {
      alert("O browser bloqueou a nova janela. Por favor permita popups para esta página (ícone na barra de endereço).");
      onDock();
      return;
    }
    
    windowRef.current = win;
    win.document.title = title;

    // IMPORTANT: Inject Tailwind CDN into the new window so styles match
    const script = win.document.createElement('script');
    script.src = "https://cdn.tailwindcss.com";
    win.document.head.appendChild(script);

    // Tailwind Config
    const configScript = win.document.createElement('script');
    configScript.text = `
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              slate: {
                850: '#1e293b',
                900: '#0f172a',
              }
            }
          }
        }
      }
    `;
    win.document.head.appendChild(configScript);

    // Create root div for React Portal
    const div = win.document.createElement('div');
    div.className = "h-full bg-gray-50 overflow-hidden flex flex-col"; // Ensure full height and flex
    win.document.body.appendChild(div);
    win.document.body.className = "h-full m-0 bg-gray-50";

    setContainer(div);

    // Handle closing via OS 'X' button
    const handleUnload = () => {
      onDock(); 
    };

    win.addEventListener('beforeunload', handleUnload);

    return () => {
      win.removeEventListener('beforeunload', handleUnload);
      win.close();
    };
  }, []);

  // Render children into the new window's DOM
  return container ? createPortal(children, container) : null;
};


const ExtractionModal: React.FC<ExtractionModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  pageRange,
  people,
  onAddPerson,
  onBulkAddPeople,
  onUpdatePerson,
  onDeletePerson,
  docTypes,
  onAddDocType,
  onBulkAddDocTypes,
  onDeleteDocType,
  facts,
  onAddFact,
  onBulkAddFacts,
  onDeleteFact,
  initialData
}) => {
  const [manualNumber, setManualNumber] = useState('');
  const [articles, setArticles] = useState(''); // New Articles state
  const [docType, setDocType] = useState(docTypes[0] || 'Outro');
  const [isCustomType, setIsCustomType] = useState(false);
  const [customType, setCustomType] = useState('');
  
  // Page Editing State
  const [editStartPage, setEditStartPage] = useState<number>(0);
  const [editEndPage, setEditEndPage] = useState<number>(0);

  // Bulk Import States
  const [isBulkImportingType, setIsBulkImportingType] = useState(false);
  const [bulkTypeInput, setBulkTypeInput] = useState('');
  
  // FACTS STATES
  const [selectedFacts, setSelectedFacts] = useState<Set<string>>(new Set(['Prova geral']));
  const [isBulkImportingFacts, setIsBulkImportingFacts] = useState(false);
  const [bulkFactsInput, setBulkFactsInput] = useState('');
  const [newFactInput, setNewFactInput] = useState('');
  const [isManagingFacts, setIsManagingFacts] = useState(false);
  
  // Selection state
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());

  // Input states for new people
  const [newArguido, setNewArguido] = useState('');
  const [newTestemunha, setNewTestemunha] = useState('');
  const [newPerito, setNewPerito] = useState('');

  // Search states for people columns
  const [searchArguido, setSearchArguido] = useState('');
  const [searchTestemunha, setSearchTestemunha] = useState('');
  const [searchPerito, setSearchPerito] = useState('');

  // Bulk People States
  const [bulkImportColumn, setBulkImportColumn] = useState<PersonType | null>(null);
  const [bulkPeopleInput, setBulkPeopleInput] = useState('');

  // Editing state
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingType, setEditingType] = useState<PersonType>('Arguido');

  // Window Management
  const [isPoppedOut, setIsPoppedOut] = useState(false);

  // Dragging State (Only used when docked)
  const modalRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{x: number, y: number} | null>(null);
  const dragOffset = useRef<{x: number, y: number}>({ x: 0, y: 0 });

  // Reset or Populate states when opening
  useEffect(() => {
    if (isOpen) {
      setEditStartPage(pageRange.start);
      setEditEndPage(pageRange.end);

      if (initialData) {
        // Edit Mode: Pre-fill data
        setManualNumber(initialData.manualNumber);
        setArticles(initialData.articles || '');
        
        // Handle Doc Type
        if (docTypes.includes(initialData.docType)) {
          setDocType(initialData.docType);
          setIsCustomType(false);
        } else {
          setDocType('Outro'); // Or whatever default
          setIsCustomType(true);
          setCustomType(initialData.docType);
        }

        // Handle People
        setSelectedPeople(new Set(initialData.selectedPeople));
        
        // Handle Facts
        setSelectedFacts(new Set(initialData.selectedFacts));
      
      } else {
        // Create Mode: Reset to defaults
        setManualNumber('');
        setArticles('');
        setDocType(docTypes[0] || 'Outro');
        setIsCustomType(false);
        setCustomType('');
        setSelectedPeople(new Set());
        setSelectedFacts(new Set(['Prova geral']));
      }
      
      // Don't reset position if already set
    } else {
      // Reset when closed
      setIsPoppedOut(false);
      setManualNumber('');
      setArticles('');
      setPosition(null); 
    }
  }, [isOpen, initialData, pageRange]);

  // Sync DocType selection if the list changes (e.g., deletion)
  useEffect(() => {
    if (!isCustomType && !docTypes.includes(docType) && docTypes.length > 0) {
      setDocType(docTypes[0]);
    }
  }, [docTypes, docType, isCustomType]);

  if (!isOpen) return null;

  // --- DRAG LOGIC (Docked Mode) ---
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPoppedOut || !modalRef.current) return;
    
    const rect = modalRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    if (!position) {
      setPosition({ x: rect.left, y: rect.top });
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    setPosition({
      x: e.clientX - dragOffset.current.x,
      y: e.clientY - dragOffset.current.y
    });
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };


  // --- SUBMISSION LOGIC ---

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalType = isCustomType ? customType : docType;
    if (manualNumber && finalType) {
      if (isCustomType) onAddDocType(customType); 
      
      // If no facts selected, default to "Prova geral" if available
      let finalFacts = Array.from(selectedFacts);
      if (finalFacts.length === 0) finalFacts = ['Prova geral'];

      // Validation
      if (editStartPage > editEndPage) {
        alert("A página inicial não pode ser maior que a final.");
        return;
      }

      // --- FORMATTING ARTICLES ---
      // Split by comma, trim, and pad numbers to 4 digits
      const formattedArticles = articles
        .split(',')
        .map(n => n.trim())
        .filter(n => n.length > 0)
        .map(n => {
            // Check if it looks like a number
            if (/^\d+$/.test(n)) {
                return n.padStart(4, '0');
            }
            return n;
        })
        .join(', ');

      onConfirm({ 
        manualNumber: manualNumber, 
        articles: formattedArticles,
        docType: finalType,
        selectedPeople: Array.from(selectedPeople),
        selectedFacts: finalFacts
      }, { start: editStartPage, end: editEndPage });
      
      setPosition(null);
      setIsPoppedOut(false);
    }
  };

  const togglePerson = (name: string) => {
    const next = new Set(selectedPeople);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setSelectedPeople(next);
  };

  const toggleFact = (fact: string) => {
     if (isManagingFacts) return; // Prevent toggling while deleting
     const next = new Set(selectedFacts);
     if (next.has(fact)) {
       next.delete(fact);
     } else {
       next.add(fact);
     }
     setSelectedFacts(next);
  };

  const handleAddPersonClick = (name: string, type: PersonType, setter: (s: string) => void) => {
    if (name.trim()) {
      onAddPerson(name.trim(), type);
      setter('');
      togglePerson(name.trim());
    }
  };

  const handleAddFactClick = () => {
    if (newFactInput.trim()) {
      onAddFact(newFactInput.trim());
      toggleFact(newFactInput.trim());
      setNewFactInput('');
    }
  };

  const startEditing = (person: Person) => {
    setEditingPersonId(person.id);
    setEditingName(person.name);
    setEditingType(person.type);
  };

  const saveEditing = () => {
    if (editingPersonId && editingName.trim()) {
      onUpdatePerson(editingPersonId, editingName.trim(), editingType);
      
      const person = people.find(p => p.id === editingPersonId);
      if (person && selectedPeople.has(person.name)) {
          const next = new Set(selectedPeople);
          next.delete(person.name);
          next.add(editingName.trim());
          setSelectedPeople(next);
      }
      setEditingPersonId(null);
      setEditingName('');
    }
  };

  const handleBulkPeopleSubmit = () => {
    if (bulkImportColumn && bulkPeopleInput.trim()) {
      const names = bulkPeopleInput.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      onBulkAddPeople(names, bulkImportColumn);
      setBulkImportColumn(null);
      setBulkPeopleInput('');
    }
  };

  const handleBulkTypeSubmit = () => {
    if (bulkTypeInput.trim()) {
      const types = bulkTypeInput.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      onBulkAddDocTypes(types);
      setIsBulkImportingType(false);
      setBulkTypeInput('');
    }
  };

  const handleBulkFactsSubmit = () => {
    if (bulkFactsInput.trim()) {
      const newFacts = bulkFactsInput.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      onBulkAddFacts(newFacts);
      setIsBulkImportingFacts(false);
      setBulkFactsInput('');
    }
  }

  const handleDeleteCurrentDocType = () => {
     onDeleteDocType(docType);
     // Note: The UI update is handled by the useEffect above which watches docTypes prop
  }

  const renderPersonColumn = (
      title: string, 
      type: PersonType, 
      inputValue: string, 
      setInput: (v: string) => void, 
      colorClass: string,
      searchTerm: string,
      setSearchTerm: (v: string) => void
    ) => {
    
    // Filter by type AND search term
    const filteredPeople = people
      .filter(p => p.type === type)
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return (
      <div className="flex-1 flex flex-col min-h-[150px] bg-gray-50 rounded-lg p-2 border border-gray-200">
        <div className="flex justify-between items-center mb-2">
            <h3 className={`text-xs font-bold uppercase tracking-wide ${colorClass}`}>{title}</h3>
            <button 
              type="button" 
              onClick={() => { setBulkImportColumn(type); setBulkPeopleInput(''); }}
              title="Colar lista"
              className="text-gray-400 hover:text-blue-600"
            >
               <ClipboardList className="w-4 h-4" />
            </button>
        </div>
        
        {bulkImportColumn === type ? (
          <div className="flex-1 flex flex-col gap-2">
            <textarea 
              autoFocus
              className="w-full text-xs p-2 border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 h-24"
              placeholder="Cole a lista aqui (um por linha)"
              value={bulkPeopleInput}
              onChange={(e) => setBulkPeopleInput(e.target.value)}
            />
            <div className="flex gap-2">
              <button 
                 type="button" 
                 onClick={handleBulkPeopleSubmit}
                 className="flex-1 bg-blue-600 text-white text-xs py-1 rounded hover:bg-blue-700"
              >
                Importar
              </button>
              <button 
                 type="button" 
                 onClick={() => setBulkImportColumn(null)}
                 className="px-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                <CloseIcon className="w-3 h-3 text-gray-500" />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Search Input for Column */}
            <div className="relative mb-2">
              <Search className="w-3 h-3 text-gray-400 absolute left-2 top-1.5" />
              <input 
                type="text"
                placeholder="Filtrar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-6 pr-2 py-1 border border-gray-200 rounded focus:ring-1 focus:ring-blue-200 outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto max-h-[150px] space-y-1 mb-2">
            {filteredPeople.length === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  {searchTerm ? 'Sem resultados' : 'Sem registos'}
                </p>
            ) : (
                filteredPeople.map(p => (
                <div key={p.id} className="group flex items-center justify-between hover:bg-gray-100 p-1 rounded">
                    {editingPersonId === p.id ? (
                    <div className="flex flex-col gap-1 w-full bg-white p-2 rounded border border-blue-300 shadow-sm z-10">
                        <input 
                          type="text" 
                          value={editingName}
                          autoFocus
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-full text-xs border border-gray-300 rounded px-1.5 py-1 mb-1"
                        />
                        <select
                          value={editingType}
                          onChange={(e) => setEditingType(e.target.value as PersonType)}
                          className="w-full text-xs border border-gray-300 rounded px-1 py-1"
                        >
                           <option value="Arguido">Arguido</option>
                           <option value="Testemunha">Testemunha / Outro</option>
                           <option value="Perito">Polícia / Perito</option>
                        </select>
                        <div className="flex justify-end gap-2 mt-1">
                           <button onClick={saveEditing} type="button" className="text-green-600 text-xs font-bold border border-green-200 px-2 rounded hover:bg-green-50">Guardar</button>
                           <button onClick={() => setEditingPersonId(null)} type="button" className="text-gray-500 text-xs border border-gray-200 px-2 rounded hover:bg-gray-50">Cancelar</button>
                        </div>
                    </div>
                    ) : (
                    <>
                        <label className="flex items-center gap-2 text-sm cursor-pointer flex-1 min-w-0">
                            <input 
                            type="checkbox" 
                            checked={selectedPeople.has(p.name)}
                            onChange={() => togglePerson(p.name)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="truncate" title={p.name}>{p.name}</span>
                        </label>
                        
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            type="button" 
                            onClick={() => startEditing(p)}
                            title="Editar"
                            className="text-gray-400 hover:text-blue-600 px-1"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => onDeletePerson(p.id)}
                            title="Eliminar"
                            className="text-gray-400 hover:text-red-500 px-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                    </>
                    )}
                </div>
                ))
            )}
            </div>

            <div className="flex gap-1">
            <input 
                type="text"
                value={inputValue}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPersonClick(inputValue, type, setInput))}
                placeholder="Novo nome..."
                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <button 
                type="button"
                onClick={() => handleAddPersonClick(inputValue, type, setInput)}
                disabled={!inputValue.trim()}
                className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 rounded p-1 disabled:opacity-50"
            >
                <UserPlus className="w-3 h-3" />
            </button>
            </div>
          </>
        )}
      </div>
    );
  };

  // --- RENDER CONTENT ---
  const ModalContent = (
    <div className={`flex flex-col h-full bg-white overflow-hidden ${isPoppedOut ? '' : ''}`}>
       {/* Header */}
      <div 
        onMouseDown={!isPoppedOut ? handleMouseDown : undefined}
        className={`bg-blue-600 px-4 py-3 text-white shrink-0 flex justify-between items-center select-none ${!isPoppedOut ? 'cursor-move rounded-t-xl' : ''}`}
      >
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            {!isPoppedOut && <Move className="w-4 h-4 opacity-70" />} 
            {initialData ? 'Editar Classificação' : 'Classificar Documento'}
          </h2>
          <div className="flex items-center gap-2 mt-1 ml-6 text-blue-100 text-xs font-mono">
            <span>Páginas:</span>
            <input 
              type="number" 
              min={1}
              value={editStartPage}
              onChange={(e) => setEditStartPage(parseInt(e.target.value) || 0)}
              className="w-12 text-center text-blue-900 rounded px-1 py-0.5"
              onMouseDown={(e) => e.stopPropagation()} // Allow clicking without drag
            />
            <span>a</span>
            <input 
              type="number" 
              min={editStartPage}
              value={editEndPage}
              onChange={(e) => setEditEndPage(parseInt(e.target.value) || 0)}
              className="w-12 text-center text-blue-900 rounded px-1 py-0.5"
              onMouseDown={(e) => e.stopPropagation()} // Allow clicking without drag
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           {/* Pop-out Toggle */}
           {!isPoppedOut ? (
             <button 
               onMouseDown={(e) => e.stopPropagation()} 
               onClick={() => setIsPoppedOut(true)}
               title="Mover para outro monitor"
               className="flex items-center gap-2 bg-blue-700 hover:bg-blue-500 hover:text-white text-blue-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors mr-2 shadow-sm border border-blue-500"
             >
               <Monitor className="w-4 h-4" />
               <span>Abrir em Janela Separada</span>
             </button>
           ) : (
             <button 
               onClick={() => setIsPoppedOut(false)}
               title="Voltar à janela principal"
               className="flex items-center gap-2 text-white bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded text-sm transition-colors mr-4"
             >
               <Minimize2 className="w-4 h-4" /> Acoplar
             </button>
           )}

           <button 
             onMouseDown={(e) => e.stopPropagation()} 
             onClick={onClose} 
             title="Fechar"
             className="text-white hover:bg-blue-700 p-1 rounded transition-colors"
           >
              <CloseIcon className="w-5 h-5" />
           </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Manual Number */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Numeração Manual
              </label>
              <input 
                type="text" 
                autoFocus={!initialData} // Only autofocus if creating new
                required
                placeholder="Ex: 0154"
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none text-lg"
              />
            </div>

            {/* Articles Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Artigos Referenciados
              </label>
              <input 
                type="text" 
                placeholder="Ex: 1, 55 (Guarda como 0001, 0055)"
                value={articles}
                onChange={(e) => setArticles(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none text-lg bg-yellow-50"
              />
              <p className="text-[10px] text-gray-400 mt-1">4 dígitos automáticos (0000) ao separar por vírgulas.</p>
            </div>

            {/* Doc Type Selection */}
            <div className="md:col-span-2">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-semibold text-gray-700">Tipo de Documento</label>
                <div className="flex gap-2 text-xs">
                    <button 
                        type="button" 
                        onClick={() => setIsBulkImportingType(!isBulkImportingType)}
                        className="text-blue-600 hover:underline"
                    >
                        Importar Lista
                    </button>
                    <span className="text-gray-300">|</span>
                    <button 
                        type="button" 
                        onClick={() => setIsCustomType(!isCustomType)}
                        className="text-blue-600 hover:underline"
                    >
                        {isCustomType ? 'Escolher da lista' : 'Criar novo tipo'}
                    </button>
                </div>
              </div>

              {isBulkImportingType ? (
                <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                    <textarea 
                        className="w-full text-sm p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 h-24 mb-2"
                        placeholder="Cole a lista de tipos aqui (um por linha)"
                        value={bulkTypeInput}
                        onChange={(e) => setBulkTypeInput(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <button 
                            type="button" 
                            onClick={handleBulkTypeSubmit}
                            className="flex-1 bg-blue-600 text-white text-xs py-2 rounded hover:bg-blue-700 font-semibold"
                        >
                            Adicionar Tipos
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setIsBulkImportingType(false)}
                            className="px-3 border border-gray-300 rounded hover:bg-white"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
              ) : isCustomType ? (
                <input 
                  type="text" 
                  required
                  placeholder="Nome do novo tipo..."
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  className="w-full border border-blue-300 bg-blue-50 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              ) : (
                <div className="flex gap-2">
                  <select 
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {docTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleDeleteCurrentDocType}
                    className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-300 rounded-lg transition-colors"
                    title="Eliminar este tipo da lista"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* FACTO SECTION */}
          <div className="mb-6 border border-indigo-100 bg-indigo-50/50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <List className="w-4 h-4 text-indigo-600" /> Factos Associados
                  </label>
                  <div className="flex gap-2 text-xs">
                      <button 
                          type="button" 
                          onClick={() => setIsManagingFacts(!isManagingFacts)}
                          className={`${isManagingFacts ? 'text-orange-600 font-bold bg-orange-100 px-2 rounded' : 'text-indigo-600 hover:underline'} flex items-center gap-1 transition-all`}
                      >
                          {isManagingFacts ? <><CloseIcon className="w-3 h-3"/> Terminar Edição</> : <><Settings className="w-3 h-3"/> Gerir</>}
                      </button>
                      <span className="text-gray-300">|</span>
                      <button 
                          type="button" 
                          onClick={() => setIsBulkImportingFacts(!isBulkImportingFacts)}
                          className="text-indigo-600 hover:underline flex items-center gap-1"
                      >
                          <ClipboardList className="w-3 h-3"/> Importar
                      </button>
                  </div>
              </div>

              {isBulkImportingFacts ? (
                  <div className="bg-white p-2 rounded border border-indigo-200">
                      <textarea 
                          className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 h-20 mb-2"
                          placeholder="Cole lista de factos aqui (um por linha)"
                          value={bulkFactsInput}
                          onChange={(e) => setBulkFactsInput(e.target.value)}
                      />
                      <div className="flex gap-2">
                          <button type="button" onClick={handleBulkFactsSubmit} className="bg-indigo-600 text-white text-xs px-3 py-1 rounded">Adicionar</button>
                          <button type="button" onClick={() => setIsBulkImportingFacts(false)} className="bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded">Cancelar</button>
                      </div>
                  </div>
              ) : (
                  <div className="flex flex-col gap-2">
                      {/* List of Facts */}
                      <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto p-1">
                          {facts.map(fact => (
                              isManagingFacts ? (
                                <div key={fact} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border bg-red-50 border-red-200 text-red-700">
                                   <span>{fact}</span>
                                   <button 
                                     type="button"
                                     onClick={() => onDeleteFact(fact)}
                                     className="p-0.5 hover:bg-red-200 rounded-full"
                                   >
                                     <CloseIcon className="w-3 h-3" />
                                   </button>
                                </div>
                              ) : (
                                <label key={fact} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border cursor-pointer select-none transition-colors ${selectedFacts.has(fact) ? 'bg-indigo-100 border-indigo-300 text-indigo-800 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedFacts.has(fact)}
                                        onChange={() => toggleFact(fact)}
                                        className="hidden"
                                    />
                                    {selectedFacts.has(fact) && <Check className="w-3 h-3" />}
                                    {fact}
                                </label>
                              )
                          ))}
                      </div>
                      {/* Add new fact */}
                      {!isManagingFacts && (
                        <div className="flex gap-2 mt-1">
                            <input 
                                type="text" 
                                value={newFactInput}
                                onChange={(e) => setNewFactInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFactClick())}
                                placeholder="Criar novo facto..."
                                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                            <button 
                                type="button" 
                                onClick={handleAddFactClick}
                                disabled={!newFactInput.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
                            >
                                Adicionar
                            </button>
                        </div>
                      )}
                  </div>
              )}
          </div>

          {/* People Selection Section */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <User className="w-4 h-4" /> Associar Intervenientes
            </label>
            <div className="flex flex-col md:flex-row gap-3">
                {renderPersonColumn('Arguidos / Suspeitos', 'Arguido', newArguido, setNewArguido, 'text-red-600', searchArguido, setSearchArguido)}
                {renderPersonColumn('Testemunhas / Outros', 'Testemunha', newTestemunha, setNewTestemunha, 'text-amber-600', searchTestemunha, setSearchTestemunha)}
                {renderPersonColumn('Polícias / Peritos', 'Perito', newPerito, setNewPerito, 'text-blue-600', searchPerito, setSearchPerito)}
            </div>
          </div>
        </div>

        {/* Footer Buttons - FIXED AT BOTTOM */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0 z-10">
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={!manualNumber || (isCustomType && !customType)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg shadow flex justify-center items-center gap-2"
            >
              <Check className="w-5 h-5" />
              {initialData ? 'Guardar Alterações' : 'Guardar Classificação'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  if (isPoppedOut) {
    return (
      <PopoutWindow 
        title={`Classificar Doc. (Páginas ${pageRange.start}-${pageRange.end})`} 
        onClose={onClose}
        onDock={() => setIsPoppedOut(false)}
      >
        {ModalContent}
      </PopoutWindow>
    );
  }

  // --- STANDARD DOCKED RENDER ---
  const style: React.CSSProperties = position 
    ? { left: position.x, top: position.y } 
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div 
      ref={modalRef}
      style={style}
      className="fixed z-[100] w-full max-w-4xl bg-transparent pointer-events-auto max-h-[90vh] flex flex-col"
    >
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col h-full border border-gray-200">
         {ModalContent}
      </div>
    </div>
  );
};

export default ExtractionModal;