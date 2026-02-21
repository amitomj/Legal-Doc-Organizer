
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
  onUpdateDocType: (oldType: string, newType: string) => void;
  onClearAllDocTypes?: () => void;
  summaries: string[];
  onAddSummary: (summary: string) => void;
  onBulkAddSummaries: (items: string[]) => void;
  onDeleteSummary: (summary: string) => void;
  onUpdateSummary: (oldSummary: string, newSummary: string) => void;
  onClearAllSummaries?: () => void;
  facts: string[];
  onAddFact: (fact: string) => void;
  onBulkAddFacts: (facts: string[]) => void;
  onDeleteFact: (fact: string) => void;
  onUpdateFact: (oldFact: string, newFact: string) => void;
  initialData?: ExtractionMeta | null; 
}

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
    const win = window.open('', '', 'width=1100,height=900,left=50,top=50,resizable=yes,scrollbars=yes,status=yes');
    if (!win) {
      alert("O browser bloqueou a nova janela. Por favor permita popups para esta página.");
      onDock();
      return;
    }
    
    windowRef.current = win;
    win.document.title = title;

    const script = win.document.createElement('script');
    script.src = "https://cdn.tailwindcss.com";
    win.document.head.appendChild(script);

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

    const styleTag = win.document.createElement('style');
    styleTag.textContent = `
      *::-webkit-scrollbar { display: none; }
      * { -ms-overflow-style: none; scrollbar-width: none; }
    `;
    win.document.head.appendChild(styleTag);

    const div = win.document.createElement('div');
    div.className = "h-full bg-gray-50 overflow-hidden flex flex-col";
    win.document.body.appendChild(div);
    win.document.body.className = "h-full m-0 bg-gray-50";

    setContainer(div);

    const handleUnload = () => {
      onDock(); 
    };

    win.addEventListener('beforeunload', handleUnload);

    return () => {
      win.removeEventListener('beforeunload', handleUnload);
      win.close();
    };
  }, []);

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
  onUpdateDocType,
  onClearAllDocTypes,
  summaries,
  onAddSummary,
  onBulkAddSummaries,
  onDeleteSummary,
  onUpdateSummary,
  onClearAllSummaries,
  facts,
  onAddFact,
  onBulkAddFacts,
  onDeleteFact,
  onUpdateFact,
  initialData
}) => {
  const [manualNumber, setManualNumber] = useState('');
  const [articles, setArticles] = useState(''); 
  const [docType, setDocType] = useState(docTypes[0] || 'Outro');
  const [isCustomType, setIsCustomType] = useState(false);
  const [customType, setCustomType] = useState('');
  const [isManagingDocTypes, setIsManagingDocTypes] = useState(false);
  const [editingDocType, setEditingDocType] = useState<string | null>(null);
  const [editingDocTypeValue, setEditingDocTypeValue] = useState('');

  const [summary, setSummary] = useState(summaries[0] || '');
  const [isCustomSummary, setIsCustomSummary] = useState(false);
  const [customSummary, setCustomSummary] = useState('');
  const [isManagingSummaries, setIsManagingSummaries] = useState(false);
  const [editingSummary, setEditingSummary] = useState<string | null>(null);
  const [editingSummaryValue, setEditingSummaryValue] = useState('');
  
  const [editStartPage, setEditStartPage] = useState<number>(0);
  const [editEndPage, setEditEndPage] = useState<number>(0);

  const [isBulkImportingType, setIsBulkImportingType] = useState(false);
  const [bulkTypeInput, setBulkTypeInput] = useState('');

  const [isBulkImportingSummary, setIsBulkImportingSummary] = useState(false);
  const [bulkSummaryInput, setBulkSummaryInput] = useState('');
  
  const [selectedFacts, setSelectedFacts] = useState<Set<string>>(new Set());
  const [isBulkImportingFacts, setIsBulkImportingFacts] = useState(false);
  const [bulkFactsInput, setBulkFactsInput] = useState('');
  const [newFactInput, setNewFactInput] = useState('');
  const [isManagingFacts, setIsManagingFacts] = useState(false);
  
  const [editingFact, setEditingFact] = useState<string | null>(null);
  const [editingFactValue, setEditingFactValue] = useState('');

  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());

  const [newArguido, setNewArguido] = useState('');
  const [newTestemunha, setNewTestemunha] = useState('');
  const [newPerito, setNewPerito] = useState('');

  const [searchArguido, setSearchArguido] = useState('');
  const [searchTestemunha, setSearchTestemunha] = useState('');
  const [searchPerito, setSearchPerito] = useState('');

  const [bulkImportColumn, setBulkImportColumn] = useState<PersonType | null>(null);
  const [bulkPeopleInput, setBulkPeopleInput] = useState('');

  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingType, setEditingType] = useState<PersonType>('Arguido');

  const [isPoppedOut, setIsPoppedOut] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{x: number, y: number} | null>(null);
  const dragOffset = useRef<{x: number, y: number}>({ x: 0, y: 0 });

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (!hasInitialized.current) {
          setEditStartPage(pageRange.start);
          setEditEndPage(pageRange.end);

          if (initialData) {
            setManualNumber(initialData.manualNumber);
            setArticles(initialData.articles || '');
            
            if (docTypes.includes(initialData.docType)) {
              setDocType(initialData.docType);
              setIsCustomType(false);
            } else {
              setDocType('Outro');
              setIsCustomType(true);
              setCustomType(initialData.docType);
            }

            if (summaries.includes(initialData.summary)) {
              setSummary(initialData.summary);
              setIsCustomSummary(false);
            } else if (initialData.summary) {
              setSummary('');
              setIsCustomSummary(true);
              setCustomSummary(initialData.summary);
            } else {
              setSummary(summaries[0] || '');
              setIsCustomSummary(false);
            }

            setSelectedPeople(new Set(initialData.selectedPeople));
            setSelectedFacts(new Set(initialData.selectedFacts));
          
          } else {
            setManualNumber('');
            setArticles('');
            setDocType(docTypes[0] || 'Outro');
            setIsCustomType(false);
            setCustomType('');
            setSummary(summaries[0] || '');
            setIsCustomSummary(false);
            setCustomSummary('');
            setSelectedPeople(new Set());
            setSelectedFacts(new Set());
          }
          
          hasInitialized.current = true;
      }
    } else {
      hasInitialized.current = false;
      setIsPoppedOut(false);
      setPosition(null); 
    }
  }, [isOpen, initialData, pageRange.start, pageRange.end]);

  useEffect(() => {
    if (!isCustomType && !docTypes.includes(docType) && docTypes.length > 0) {
      setDocType(docTypes[0]);
    }
  }, [docTypes, docType, isCustomType]);

  useEffect(() => {
    if (!isCustomSummary && !summaries.includes(summary) && summaries.length > 0) {
      setSummary(summaries[0]);
    }
  }, [summaries, summary, isCustomSummary]);

  if (!isOpen) return null;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPoppedOut || !modalRef.current) return;
    const rect = modalRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!position) setPosition({ x: rect.left, y: rect.top });
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    setPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
  };

  const handleMouseUp = () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalType = isCustomType ? customType : docType;
    const finalSummary = isCustomSummary ? customSummary : summary;

    if (manualNumber && finalType) {
      if (isCustomType) onAddDocType(customType); 
      if (isCustomSummary && customSummary) onAddSummary(customSummary);
      
      if (editStartPage > editEndPage) {
        alert("A página inicial não pode ser maior que a final.");
        return;
      }

      const formattedArticles = articles
        .split(',')
        .map(n => n.trim())
        .filter(n => n.length > 0)
        .map(n => {
            if (/^\d+$/.test(n)) return n.padStart(4, '0');
            return n;
        })
        .join(', ');

      onConfirm({ 
        manualNumber, 
        articles: formattedArticles,
        docType: finalType,
        summary: finalSummary,
        selectedPeople: Array.from(selectedPeople),
        selectedFacts: Array.from(selectedFacts)
      }, { start: editStartPage, end: editEndPage });
      
      setPosition(null);
      setIsPoppedOut(false);
    }
  };

  const togglePerson = (name: string) => {
    const next = new Set(selectedPeople);
    if (next.has(name)) next.delete(name); else next.add(name);
    setSelectedPeople(next);
  };

  const toggleFact = (fact: string) => {
     if (isManagingFacts) return;
     const next = new Set(selectedFacts);
     if (next.has(fact)) next.delete(fact); else next.add(fact);
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

  const startEditingFact = (fact: string) => {
    setEditingFact(fact);
    setEditingFactValue(fact);
  };

  const saveEditingFact = () => {
    if (editingFact && editingFactValue.trim()) {
      onUpdateFact(editingFact, editingFactValue.trim());
      if (selectedFacts.has(editingFact)) {
        const next = new Set(selectedFacts);
        next.delete(editingFact);
        next.add(editingFactValue.trim());
        setSelectedFacts(next);
      }
      setEditingFact(null);
      setEditingFactValue('');
    }
  };

  const startEditingDocType = (type: string) => {
    setEditingDocType(type);
    setEditingDocTypeValue(type);
  };

  const saveEditingDocType = () => {
    if (editingDocType && editingDocTypeValue.trim()) {
      onUpdateDocType(editingDocType, editingDocTypeValue.trim());
      if (docType === editingDocType) setDocType(editingDocTypeValue.trim());
      setEditingDocType(null);
      setEditingDocTypeValue('');
    }
  };

  const startEditingSummary = (s: string) => {
    setEditingSummary(s);
    setEditingSummaryValue(s);
  };

  const saveEditingSummary = () => {
    if (editingSummary && editingSummaryValue.trim()) {
      onUpdateSummary(editingSummary, editingSummaryValue.trim());
      if (summary === editingSummary) setSummary(editingSummaryValue.trim());
      setEditingSummary(null);
      setEditingSummaryValue('');
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

  const handleBulkSummarySubmit = () => {
    if (bulkSummaryInput.trim()) {
      const items = bulkSummaryInput.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      onBulkAddSummaries(items);
      setIsBulkImportingSummary(false);
      setBulkSummaryInput('');
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

  const handleDeleteCurrentDocType = () => onDeleteDocType(docType);
  const handleDeleteCurrentSummary = () => onDeleteSummary(summary);

  const renderPersonColumn = (title: string, type: PersonType, inputValue: string, setInput: (v: string) => void, colorClass: string, searchTerm: string, setSearchTerm: (v: string) => void) => {
    const filteredPeople = people.filter(p => p.type === type).filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return (
      <div className="flex-1 flex flex-col min-h-[200px] bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div className="flex justify-between items-center mb-2">
            <h3 className={`text-xs font-bold uppercase tracking-wide ${colorClass}`}>{title}</h3>
            <button type="button" onClick={() => { setBulkImportColumn(type); setBulkPeopleInput(''); }} title="Colar lista" className="text-gray-400 hover:text-blue-600"><ClipboardList className="w-4 h-4" /></button>
        </div>
        {bulkImportColumn === type ? (
          <div className="flex-1 flex flex-col gap-2">
            <textarea autoFocus className="w-full text-xs p-2 border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 h-24" placeholder="Cole a lista aqui (um por linha)" value={bulkPeopleInput} onChange={(e) => setBulkPeopleInput(e.target.value)} />
            <div className="flex gap-2">
              <button type="button" onClick={handleBulkPeopleSubmit} className="flex-1 bg-blue-600 text-white text-xs py-1 rounded hover:bg-blue-700">Importar</button>
              <button type="button" onClick={() => setBulkImportColumn(null)} className="px-2 border border-gray-300 rounded hover:bg-gray-100"><CloseIcon className="w-3 h-3 text-gray-500" /></button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="w-3 h-3 text-gray-400 absolute left-2 top-2.5" />
              <input type="text" placeholder="Filtrar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full text-xs pl-7 pr-2 py-2 border border-gray-200 rounded focus:ring-1 focus:ring-blue-200 outline-none" />
            </div>
            <div className="flex-1 overflow-y-auto max-h-[250px] space-y-1 mb-2">
            {filteredPeople.length === 0 ? <p className="text-xs text-gray-400 italic">{searchTerm ? 'Sem resultados' : 'Sem registos'}</p> : filteredPeople.map(p => (
                <div key={p.id} className="group flex items-center justify-between hover:bg-gray-100 p-1.5 rounded">
                    {editingPersonId === p.id ? (
                    <div className="flex flex-col gap-1 w-full bg-white p-2 rounded border border-blue-300 shadow-sm z-10">
                        <input type="text" value={editingName} autoFocus onChange={(e) => setEditingName(e.target.value)} className="w-full text-xs border border-gray-300 rounded px-1.5 py-1.5 mb-1" />
                        <select value={editingType} onChange={(e) => setEditingType(e.target.value as PersonType)} className="w-full text-xs border border-gray-300 rounded px-1 py-1.5"><option value="Arguido">Arguido</option><option value="Testemunha">Testemunha / Outro</option><option value="Perito">Polícia / Perito</option></select>
                        <div className="flex justify-end gap-2 mt-1">
                           <button onClick={saveEditing} type="button" className="text-green-600 text-xs font-bold border border-green-200 px-2 py-1 rounded hover:bg-green-50">Guardar</button>
                           <button onClick={() => setEditingPersonId(null)} type="button" className="text-gray-500 text-xs border border-gray-200 px-2 py-1 rounded hover:bg-gray-50">Cancelar</button>
                        </div>
                    </div>
                    ) : (
                    <>
                        <label className="flex items-center gap-2 text-sm cursor-pointer flex-1 min-w-0"><input type="checkbox" checked={selectedPeople.has(p.name)} onChange={() => togglePerson(p.name)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /><span className="truncate" title={p.name}>{p.name}</span></label>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => startEditing(p)} title="Editar" className="text-gray-400 hover:text-blue-600 px-1"><Pencil className="w-3 h-3" /></button>
                          <button type="button" onClick={() => onDeletePerson(p.id)} title="Eliminar" className="text-gray-400 hover:text-red-500 px-1"><Trash2 className="w-3 h-3" /></button>
                        </div>
                    </>
                    )}
                </div>
                ))}
            </div>
            <div className="flex gap-1">
            <input type="text" value={inputValue} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPersonClick(inputValue, type, setInput))} placeholder="Novo nome..." className="flex-1 text-xs border border-gray-300 rounded px-2 py-2 focus:ring-1 focus:ring-blue-500 outline-none" />
            <button type="button" onClick={() => handleAddPersonClick(inputValue, type, setInput)} disabled={!inputValue.trim()} className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-600 rounded p-1.5 disabled:opacity-50"><UserPlus className="w-4 h-4" /></button>
            </div>
          </>
        )}
      </div>
    );
  };

  const ModalContent = (
    <div className={`flex flex-col h-full bg-white overflow-hidden`}>
      <div onMouseDown={!isPoppedOut ? handleMouseDown : undefined} className={`bg-blue-600 px-5 py-4 text-white shrink-0 flex justify-between items-center select-none ${!isPoppedOut ? 'cursor-move rounded-t-xl' : ''}`}>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">{!isPoppedOut && <Move className="w-5 h-5 opacity-70" />} {initialData ? 'Editar Classificação' : 'Classificar Documento'}</h2>
          <div className="flex items-center gap-2 mt-2 ml-7 text-blue-100 text-sm font-mono">
            <span>Páginas:</span>
            <input type="number" min={1} value={editStartPage} onChange={(e) => setEditStartPage(parseInt(e.target.value) || 0)} className="w-16 text-center text-blue-900 rounded px-2 py-1" onMouseDown={(e) => e.stopPropagation()} />
            <span>a</span>
            <input type="number" min={editStartPage} value={editEndPage} onChange={(e) => setEditEndPage(parseInt(e.target.value) || 0)} className="w-16 text-center text-blue-900 rounded px-2 py-1" onMouseDown={(e) => e.stopPropagation()} />
          </div>
        </div>
        <div className="flex items-center gap-3">
           {!isPoppedOut ? (
             <button onMouseDown={(e) => e.stopPropagation()} onClick={() => setIsPoppedOut(true)} title="Mover para outro monitor" className="flex items-center gap-2 bg-blue-700 hover:bg-blue-500 hover:text-white text-blue-100 px-4 py-2 rounded-lg text-sm font-semibold transition-colors mr-2 shadow-sm border border-blue-500"><Monitor className="w-5 h-5" /><span>Abrir em Janela Separada</span></button>
           ) : (
             <button onClick={() => setIsPoppedOut(false)} className="flex items-center gap-2 text-white bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded text-base transition-colors mr-4"><Minimize2 className="w-5 h-5" /> Acoplar</button>
           )}
           <button onMouseDown={(e) => e.stopPropagation()} onClick={onClose} className="text-white hover:bg-blue-700 p-2 rounded transition-colors"><CloseIcon className="w-6 h-6" /></button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
        <div className="flex-1 overflow-y-auto p-8 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">N.º da Página (Manual)</label>
              <input type="text" autoFocus={!initialData} required placeholder="Ex: 0154" value={manualNumber} onChange={(e) => setManualNumber(e.target.value)} className="w-full border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 outline-none text-xl font-mono" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Artigos Referenciados</label>
              <input type="text" placeholder="Ex: 1, 55 (Guarda como 0001, 0055)" value={articles} onChange={(e) => setArticles(e.target.value)} className="w-full border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 outline-none text-xl bg-yellow-50" />
            </div>

            {/* Tipo de Documento Section */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-gray-700">Tipo de Documento</label>
                <div className="flex gap-2 text-[10px]">
                    <button type="button" onClick={() => setIsManagingDocTypes(!isManagingDocTypes)} className={`${isManagingDocTypes ? 'text-orange-600 font-bold bg-orange-100 px-2 py-0.5 rounded' : 'text-blue-600 hover:underline'} flex items-center gap-1 font-semibold transition-all`}>
                        {isManagingDocTypes ? <><CloseIcon className="w-3 h-3"/> Sair</> : <><Settings className="w-3 h-3"/> Gerir</>}
                    </button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={() => setIsBulkImportingType(!isBulkImportingType)} className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"><ClipboardList className="w-3 h-3"/> Importar</button>
                    {onClearAllDocTypes && <button type="button" onClick={onClearAllDocTypes} className="text-red-600 hover:underline flex items-center gap-1 font-semibold"><Trash2 className="w-3 h-3"/> Limpar</button>}
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={() => setIsCustomType(!isCustomType)} className="text-blue-600 hover:underline font-semibold">{isCustomType ? 'Lista' : 'Criar Novo'}</button>
                </div>
              </div>
              
              {isManagingDocTypes ? (
                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  {docTypes.map(t => (
                    <div key={t} className="flex items-center justify-between p-1.5 bg-white rounded border border-gray-100 group">
                      {editingDocType === t ? (
                        <div className="flex items-center gap-2 w-full">
                           <input autoFocus value={editingDocTypeValue} onChange={(e) => setEditingDocTypeValue(e.target.value)} className="flex-1 text-sm border-b border-blue-400 outline-none" />
                           <button onClick={saveEditingDocType} type="button" className="text-green-600"><Check className="w-4 h-4"/></button>
                           <button onClick={() => setEditingDocType(null)} type="button" className="text-red-400"><CloseIcon className="w-4 h-4"/></button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm truncate pr-2">{t}</span>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => startEditingDocType(t)} className="text-blue-500 hover:text-blue-700 transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                            <button type="button" onClick={() => onDeleteDocType(t)} className="text-red-500 hover:text-red-700 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {docTypes.length === 0 && <p className="text-xs text-gray-400 italic p-2 text-center">Nenhum tipo na lista.</p>}
                </div>
              ) : isBulkImportingType ? (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <textarea className="w-full text-sm p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 h-28 mb-3" placeholder="Cole a lista de tipos aqui (um por linha)" value={bulkTypeInput} onChange={(e) => setBulkTypeInput(e.target.value)} />
                    <div className="flex gap-2"><button type="button" onClick={handleBulkTypeSubmit} className="flex-1 bg-blue-600 text-white text-sm py-2 rounded hover:bg-blue-700 font-bold">Adicionar</button><button type="button" onClick={() => setIsBulkImportingType(false)} className="px-4 border border-gray-300 rounded text-sm">Sair</button></div>
                </div>
              ) : isCustomType ? (
                <input type="text" required placeholder="Novo tipo..." value={customType} onChange={(e) => setCustomType(e.target.value)} className="w-full border border-blue-300 bg-blue-50 rounded-lg p-4 outline-none text-lg" />
              ) : (
                <div className="flex gap-3">
                  <select value={docType} onChange={(e) => setDocType(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-4 outline-none text-lg">{docTypes.map(type => <option key={type} value={type}>{type}</option>)}{docTypes.length === 0 && <option value="">Nenhum tipo disponível.</option>}</select>
                  <button type="button" onClick={handleDeleteCurrentDocType} className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-300 rounded-lg transition-colors"><Trash2 className="w-6 h-6" /></button>
                </div>
              )}
            </div>

            {/* Resumo Section */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-gray-700">Resumo do Documento</label>
                <div className="flex gap-2 text-[10px]">
                    <button type="button" onClick={() => setIsManagingSummaries(!isManagingSummaries)} className={`${isManagingSummaries ? 'text-orange-600 font-bold bg-orange-100 px-2 py-0.5 rounded' : 'text-blue-600 hover:underline'} flex items-center gap-1 font-semibold transition-all`}>
                        {isManagingSummaries ? <><CloseIcon className="w-3 h-3"/> Sair</> : <><Settings className="w-3 h-3"/> Gerir</>}
                    </button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={() => setIsBulkImportingSummary(!isBulkImportingSummary)} className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"><ClipboardList className="w-3 h-3"/> Importar</button>
                    {onClearAllSummaries && <button type="button" onClick={onClearAllSummaries} className="text-red-600 hover:underline flex items-center gap-1 font-semibold"><Trash2 className="w-3 h-3"/> Limpar</button>}
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={() => setIsCustomSummary(!isCustomSummary)} className="text-blue-600 hover:underline font-semibold">{isCustomSummary ? 'Lista' : 'Criar Novo'}</button>
                </div>
              </div>

              {isManagingSummaries ? (
                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  {summaries.map(s => (
                    <div key={s} className="flex items-center justify-between p-1.5 bg-white rounded border border-gray-100 group">
                      {editingSummary === s ? (
                        <div className="flex items-center gap-2 w-full">
                           <input autoFocus value={editingSummaryValue} onChange={(e) => setEditingSummaryValue(e.target.value)} className="flex-1 text-sm border-b border-blue-400 outline-none" />
                           <button onClick={saveEditingSummary} type="button" className="text-green-600"><Check className="w-4 h-4"/></button>
                           <button onClick={() => setEditingSummary(null)} type="button" className="text-red-400"><CloseIcon className="w-4 h-4"/></button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm truncate pr-2">{s}</span>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => startEditingSummary(s)} className="text-blue-500 hover:text-blue-700 transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                            <button type="button" onClick={() => onDeleteSummary(s)} className="text-red-500 hover:text-red-700 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {summaries.length === 0 && <p className="text-xs text-gray-400 italic p-2 text-center">Nenhum resumo na lista.</p>}
                </div>
              ) : isBulkImportingSummary ? (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <textarea className="w-full text-sm p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 h-28 mb-3" placeholder="Cole a lista de resumos padronizados aqui (um por linha)" value={bulkSummaryInput} onChange={(e) => setBulkSummaryInput(e.target.value)} />
                    <div className="flex gap-2"><button type="button" onClick={handleBulkSummarySubmit} className="flex-1 bg-blue-600 text-white text-sm py-2 rounded hover:bg-blue-700 font-bold">Adicionar</button><button type="button" onClick={() => setIsBulkImportingSummary(false)} className="px-4 border border-gray-300 rounded text-sm">Sair</button></div>
                </div>
              ) : isCustomSummary ? (
                <input type="text" placeholder="Escreva o resumo aqui..." value={customSummary} onChange={(e) => setCustomSummary(e.target.value)} className="w-full border border-blue-300 bg-blue-50 rounded-lg p-4 outline-none text-lg" />
              ) : (
                <div className="flex gap-3">
                  <select value={summary} onChange={(e) => setSummary(e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-4 outline-none text-lg">
                    <option value="">(Sem resumo selecionado)</option>
                    {summaries.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" onClick={handleDeleteCurrentSummary} className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-300 rounded-lg transition-colors"><Trash2 className="w-6 h-6" /></button>
                </div>
              )}
            </div>
          </div>

          <div className="mb-8 border border-indigo-100 bg-indigo-50/50 rounded-xl p-5">
              <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><List className="w-5 h-5 text-indigo-600" /> Factos Associados</label>
                  <div className="flex gap-3 text-xs">
                      <button type="button" onClick={() => setIsManagingFacts(!isManagingFacts)} className={`${isManagingFacts ? 'text-orange-600 font-bold bg-orange-100 px-3 py-1 rounded' : 'text-indigo-600 hover:underline'} flex items-center gap-1 font-semibold`}>{isManagingFacts ? <><CloseIcon className="w-3 h-3"/> Sair</> : <><Settings className="w-3 h-3"/> Gerir</>}</button>
                      <span className="text-gray-300">|</span>
                      <button type="button" onClick={() => setIsBulkImportingFacts(!isBulkImportingFacts)} className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"><ClipboardList className="w-3 h-3"/> Importar</button>
                  </div>
              </div>
              {isBulkImportingFacts ? (
                  <div className="bg-white p-3 rounded-lg border border-indigo-200">
                      <textarea className="w-full text-xs p-3 border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 h-24 mb-3" placeholder="Cole lista de factos aqui (um por linha)" value={bulkFactsInput} onChange={(e) => setBulkFactsInput(e.target.value)} />
                      <div className="flex gap-3"><button type="button" onClick={handleBulkFactsSubmit} className="bg-indigo-600 text-white text-xs px-4 py-2 rounded font-bold">Adicionar</button><button type="button" onClick={() => setIsBulkImportingFacts(false)} className="bg-gray-200 text-gray-700 text-xs px-4 py-2 rounded">Cancelar</button></div>
                  </div>
              ) : (
                  <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto p-1.5 bg-white/50 rounded-lg border border-indigo-50">
                          {facts.map(fact => (isManagingFacts ? (editingFact === fact ? (
                                  <div key={fact} className="flex items-center gap-1 bg-white border border-indigo-300 rounded-full px-3 py-1"><input type="text" autoFocus value={editingFactValue} onChange={(e) => setEditingFactValue(e.target.value)} className="text-xs w-32 outline-none py-0.5" /><button onClick={saveEditingFact} type="button" className="text-green-600 hover:bg-green-100 rounded-full p-1"><Check className="w-3.5 h-3.5"/></button><button onClick={() => setEditingFact(null)} type="button" className="text-gray-400 hover:bg-gray-100 rounded-full p-1"><CloseIcon className="w-3.5 h-3.5"/></button></div>
                                ) : (
                                  <div key={fact} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border bg-white border-indigo-200 text-indigo-700"><span className="font-medium">{fact}</span><div className="flex gap-1 border-l border-indigo-100 pl-1"><button type="button" onClick={() => startEditingFact(fact)} className="p-1 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button><button type="button" onClick={() => onDeleteFact(fact)} className="p-1 hover:bg-red-100 rounded-full text-gray-400 hover:text-red-500"><CloseIcon className="w-3.5 h-3.5" /></button></div></div>
                                )) : (
                                <label key={fact} className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs border cursor-pointer select-none transition-all ${selectedFacts.has(fact) ? 'bg-indigo-100 border-indigo-300 text-indigo-800 font-bold shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}><input type="checkbox" checked={selectedFacts.has(fact)} onChange={() => toggleFact(fact)} className="hidden" />{selectedFacts.has(fact) && <Check className="w-4 h-4" />}{fact}</label>
                              )
                          ))}
                      </div>
                      {!isManagingFacts && (
                        <div className="flex gap-2 mt-1"><input type="text" value={newFactInput} onChange={(e) => setNewFactInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFactClick())} placeholder="Criar novo facto..." className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-indigo-500 outline-none" /><button type="button" onClick={handleAddFactClick} disabled={!newFactInput.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm disabled:opacity-50">Adicionar Facto</button></div>
                      )}
                  </div>
              )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><User className="w-5 h-5 text-gray-800" /> Associar Intervenientes</label>
            <div className="flex flex-col md:flex-row gap-4">
                {renderPersonColumn('Arguidos / Suspeitos', 'Arguido', newArguido, setNewArguido, 'text-red-700', searchArguido, setSearchArguido)}
                {renderPersonColumn('Testemunhas / Outros', 'Testemunha', newTestemunha, setNewTestemunha, 'text-amber-700', searchTestemunha, setSearchTestemunha)}
                {renderPersonColumn('Polícias / Peritos', 'Perito', newPerito, setNewPerito, 'text-blue-700', searchPerito, setSearchPerito)}
            </div>
          </div>
        </div>

        <div className="p-5 bg-gray-50 border-t border-gray-200 shrink-0 z-10">
          <div className="flex gap-4 max-w-4xl mx-auto">
            <button type="button" onClick={onClose} className="flex-1 py-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-bold transition-all">Cancelar</button>
            <button type="submit" disabled={!manualNumber || (isCustomType && !customType)} className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg flex justify-center items-center gap-3 text-lg transition-all transform active:scale-[0.98]"><Check className="w-6 h-6" />{initialData ? 'Guardar Alterações' : 'Guardar Classificação'}</button>
          </div>
        </div>
      </form>
    </div>
  );

  if (isPoppedOut) {
    return (
      <PopoutWindow title={initialData ? 'Editar Classificação' : 'Classificar Documento'} onClose={onClose} onDock={() => setIsPoppedOut(false)}>
        {ModalContent}
      </PopoutWindow>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div ref={modalRef} style={position ? { position: 'absolute', left: position.x, top: position.y, margin: 0 } : {}} className={`bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col h-full max-h-[95vh] ${!position ? 'animate-in fade-in zoom-in duration-300' : ''}`}>
        {ModalContent}
      </div>
    </div>
  );
};

export default ExtractionModal;
