
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './components/Sidebar';
import PdfViewer from './components/PdfViewer';
import UploadModal from './components/UploadModal';
import SearchDashboard from './components/SearchDashboard';
import ExtractionModal from './components/ExtractionModal';
import DeleteConfirmationModal, { DeleteItemType } from './components/DeleteConfirmationModal';
import GenericConfirmModal from './components/GenericConfirmModal';
import { CaseFile, DocCategory, ExtractionMeta, Extraction, Person, PersonType } from './types';
import { processAndExport, generatePartialPdf } from './services/pdfProcessing';
import { DEFAULT_DOC_TYPES, DEFAULT_FACTS } from './constants';
import { FolderSearch, FileSearch, AlertCircle, FolderOpen } from 'lucide-react';

export type ViewMode = 'organizer' | 'search';

interface DeleteRequest {
  type: 'person' | 'docType' | 'fact';
  id?: string;
  name: string;
}

interface GenericConfirmRequest {
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  isDestructive: boolean;
}

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'search' ? 'search' : 'organizer';
  });
  
  const [files, setFiles] = useState<CaseFile[]>([]);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [initialPageToJump, setInitialPageToJump] = useState<number | null>(null);
  const [searchNavTrigger, setSearchNavTrigger] = useState(0);
  const [editingExtraction, setEditingExtraction] = useState<{fileId: string, extraction: Extraction} | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const [deleteUsageCount, setDeleteUsageCount] = useState(0);
  const [confirmRequest, setConfirmRequest] = useState<GenericConfirmRequest | null>(null);
  const [availableFiles, setAvailableFiles] = useState<File[]>([]);
  const [rootFolderName, setRootFolderName] = useState<string | null>(null);
  const rootFolderInputRef = useRef<HTMLInputElement>(null);
  const relinkInputRef = useRef<HTMLInputElement>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [docTypes, setDocTypes] = useState<string[]>(DEFAULT_DOC_TYPES);
  const [facts, setFacts] = useState<string[]>(DEFAULT_FACTS);

  const uniqueApensos = Array.from(new Set(files.filter(f => f.category === 'Apenso' && f.categoryName).map(f => f.categoryName!))).sort();
  const uniqueAnexos = Array.from(new Set(files.filter(f => f.category === 'Anexo' && f.categoryName).map(f => f.categoryName!))).sort();

  const handleSetRootFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []) as File[];
    if (uploadedFiles.length === 0) return;
    const pdfs = uploadedFiles.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    setAvailableFiles(pdfs);
    const firstPath = pdfs[0]?.webkitRelativePath || '';
    const folderName = firstPath.split('/')[0] || 'Pasta Selecionada';
    setRootFolderName(folderName);
    if (files.some(f => !f.file)) {
      autoLinkFiles(files, pdfs);
    }
  };

  const autoLinkFiles = (currentFiles: CaseFile[], pool: File[]) => {
    let matchedCount = 0;
    const newFiles = currentFiles.map(projectFile => {
      if (projectFile.file) return projectFile;
      let match = projectFile.relativePath ? pool.find(f => f.webkitRelativePath === projectFile.relativePath) : undefined;
      if (!match) match = pool.find(f => f.name === projectFile.fileName);
      if (match) {
        matchedCount++;
        return { ...projectFile, file: match, relativePath: match.webkitRelativePath };
      }
      return projectFile;
    });
    setFiles(newFiles);
  };

  const handleUpload = (file: File, category: DocCategory, name: string, volume: string) => {
    if (currentFileId) {
       const existing = files.find(f => f.id === currentFileId);
       if (existing && !existing.file) {
          setFiles(prev => prev.map(f => {
            if (f.id === currentFileId) {
               return { ...f, file, volume: volume || f.volume, fileName: file.name, relativePath: file.webkitRelativePath };
            }
            return f;
          }));
          return;
       }
    }
    const newFile: CaseFile = { id: uuidv4(), file, fileName: file.name, relativePath: file.webkitRelativePath, category, categoryName: category === 'Autos Principais' ? undefined : name, volume, extractions: [] };
    setFiles(prev => [...prev, newFile]);
    if (!currentFileId) setCurrentFileId(newFile.id);
  };

  const handleUpdateCategoryName = (oldName: string, newName: string, category: DocCategory) => {
     setFiles(prev => prev.map(f => {
       if (f.category === category && f.categoryName === oldName) return { ...f, categoryName: newName };
       return f;
     }));
  };

  const handleDeleteFile = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;
    const extractionCount = file.extractions.length;
    const message = (
      <>
        <p>Tem a certeza que deseja eliminar o ficheiro do <strong>Volume {file.volume}</strong>?</p>
        {extractionCount > 0 && <p className="mt-2 text-red-600 font-bold">ATENÇÃO: Isto eliminará também {extractionCount} documento(s) classificado(s) associado(s) a este ficheiro.</p>}
      </>
    );
    setConfirmRequest({ title: "Eliminar Ficheiro", message, isDestructive: true, onConfirm: () => { setFiles(prev => prev.filter(f => f.id !== fileId)); if (currentFileId === fileId) setCurrentFileId(null); } });
  };

  const handleDeleteGroup = (category: DocCategory, name: string) => {
    if (category === 'Autos Principais') return;
    const filesInGroup = files.filter(f => f.category === category && f.categoryName === name);
    if (filesInGroup.length === 0) return;
    const totalExtractions = filesInGroup.reduce((acc, f) => acc + f.extractions.length, 0);
    const message = (
      <>
        <p>Tem a certeza que deseja eliminar todo o <strong>"{name}"</strong> ({category})?</p>
        <p className="mt-2">Isto removerá <strong>{filesInGroup.length} ficheiro(s) PDF</strong> da lista.</p>
        {totalExtractions > 0 && <p className="mt-2 text-red-600 font-bold">ATENÇÃO: Isto eliminará também {totalExtractions} documento(s) classificado(s).</p>}
      </>
    );
    setConfirmRequest({ title: `Eliminar ${category}`, message, isDestructive: true, onConfirm: () => { setFiles(prev => prev.filter(f => !(f.category === category && f.categoryName === name))); if (currentFileId) { const currentFile = files.find(f => f.id === currentFileId); if (currentFile && currentFile.category === category && currentFile.categoryName === name) setCurrentFileId(null); } } });
  };

  const currentFile = files.find(f => f.id === currentFileId);

  const handleAddPerson = (name: string, type: PersonType) => {
    if (people.some(p => p.name === name)) return;
    setPeople(prev => [...prev, { id: uuidv4(), name, type }]);
  };

  const handleBulkAddPeople = (names: string[], type: PersonType) => {
    const newPeople = names.filter(name => !people.some(p => p.name === name)).map(name => ({ id: uuidv4(), name, type }));
    setPeople(prev => [...prev, ...newPeople]);
  };

  const handleUpdatePerson = (id: string, newName: string, newType?: PersonType) => {
    if (people.some(p => p.id !== id && p.name === newName)) { alert("Já existe um interveniente com este nome."); return; }
    setPeople(prev => prev.map(p => p.id === id ? { ...p, name: newName, type: newType || p.type } : p));
    const person = people.find(p => p.id === id);
    if (person && person.name !== newName) {
      setFiles(prev => prev.map(f => ({ ...f, extractions: f.extractions.map(e => ({ ...e, people: e.people.map(pName => pName === person.name ? newName : pName) })) })));
    }
  };

  const getUsageCount = (type: 'person' | 'docType' | 'fact', value: string) => {
    let count = 0;
    files.forEach(f => f.extractions.forEach(ext => {
      if (type === 'person' && ext.people.includes(value)) count++;
      if (type === 'docType' && ext.docType === value) count++;
      if (type === 'fact' && (ext.facts || []).includes(value)) count++;
    }));
    return count;
  };

  const handleDeletePerson = (id: string) => {
    const person = people.find(p => p.id === id);
    if (!person) return;
    const count = getUsageCount('person', person.name);
    if (count > 0) { setDeleteRequest({ type: 'person', id, name: person.name }); setDeleteUsageCount(count); }
    else { setConfirmRequest({ title: "Eliminar Interveniente", message: `Tem a certeza que deseja eliminar "${person.name}"?`, isDestructive: true, onConfirm: () => setPeople(prev => prev.filter(p => p.id !== id)) }); }
  };

  const handleDeleteDocType = (type: string) => {
    const count = getUsageCount('docType', type);
    if (count > 0) { setDeleteRequest({ type: 'docType', name: type }); setDeleteUsageCount(count); }
    else { setConfirmRequest({ title: "Eliminar Tipo de Documento", message: `Tem a certeza que deseja eliminar o tipo "${type}"?`, isDestructive: true, onConfirm: () => setDocTypes(prev => prev.filter(t => t !== type)) }); }
  };

  const handleClearAllDocTypes = () => {
    setConfirmRequest({
      title: "Limpar Todos os Tipos",
      message: "Tem a certeza que deseja apagar todos os tipos de documento da lista? Isto não afetará os documentos já classificados, mas deixará a lista de seleção vazia.",
      isDestructive: true,
      onConfirm: () => setDocTypes([])
    });
  };

  const handleDeleteFact = (fact: string) => {
    const count = getUsageCount('fact', fact);
    if (count > 0) { setDeleteRequest({ type: 'fact', name: fact }); setDeleteUsageCount(count); }
    else { setConfirmRequest({ title: "Eliminar Facto", message: `Tem a certeza que deseja eliminar o facto "${fact}"?`, isDestructive: true, onConfirm: () => setFacts(prev => prev.filter(f => f !== fact)) }); }
  };

  const executeDelete = () => {
    if (!deleteRequest) return;
    const { type, name, id } = deleteRequest;
    setFiles(prev => prev.map(f => ({ ...f, extractions: f.extractions.map(ext => {
      if (type === 'person') return { ...ext, people: ext.people.filter(p => p !== name) };
      if (type === 'fact') return { ...ext, facts: (ext.facts || []).filter(fact => fact !== name) };
      if (type === 'docType' && ext.docType === name) {
        const fallback = docTypes.find(t => t !== name) || DEFAULT_DOC_TYPES[0] || 'Indefinido';
        return { ...ext, docType: fallback };
      }
      return ext;
    }) })));
    if (type === 'person' && id) setPeople(prev => prev.filter(p => p.id !== id));
    if (type === 'docType') setDocTypes(prev => prev.filter(t => t !== name));
    if (type === 'fact') setFacts(prev => prev.filter(f => f !== name));
    setDeleteRequest(null);
  };

  const executeReplace = (replacement: string) => {
    if (!deleteRequest) return;
    const { type, name, id } = deleteRequest;
    setFiles(prev => prev.map(f => ({ ...f, extractions: f.extractions.map(ext => {
      if (type === 'person' && ext.people.includes(name)) {
           const newPeople = ext.people.filter(p => p !== name);
           if (!newPeople.includes(replacement)) newPeople.push(replacement);
           return { ...ext, people: newPeople };
      }
      if (type === 'fact' && (ext.facts || []).includes(name)) {
           const newFacts = (ext.facts || []).filter(fact => fact !== name);
           if (!newFacts.includes(replacement)) newFacts.push(replacement);
           return { ...ext, facts: newFacts };
      }
      if (type === 'docType' && ext.docType === name) return { ...ext, docType: replacement };
      return ext;
    }) })));
    if (type === 'person' && id) setPeople(prev => prev.filter(p => p.id !== id));
    if (type === 'docType') setDocTypes(prev => prev.filter(t => t !== name));
    if (type === 'fact') setFacts(prev => prev.filter(f => f !== name));
    setDeleteRequest(null);
  };

  const handleAddDocType = (type: string) => { if (!docTypes.includes(type)) setDocTypes(prev => [...prev, type].sort()); };
  const handleBulkAddDocTypes = (types: string[]) => { setDocTypes(prev => Array.from(new Set([...prev, ...types])).sort()); };
  const handleAddFact = (fact: string) => { if (!facts.includes(fact)) setFacts(prev => [...prev, fact].sort()); };
  const handleBulkAddFacts = (newFacts: string[]) => { setFacts(prev => Array.from(new Set([...prev, ...newFacts])).sort()); };

  const handleUpdateFact = (oldFact: string, newFact: string) => {
    if (oldFact === newFact) return;
    if (facts.includes(newFact)) { alert("Já existe um facto com este nome."); return; }
    setFacts(prev => prev.map(f => f === oldFact ? newFact : f));
    setFiles(prev => prev.map(f => ({ ...f, extractions: f.extractions.map(ext => ({ ...ext, facts: (ext.facts || []).map(fact => fact === oldFact ? newFact : fact) })) })));
  };

  const handleAddExtraction = (start: number, end: number, meta: ExtractionMeta) => {
    if (!currentFileId) return;
    const newExtraction: Extraction = { id: uuidv4(), startPage: start, endPage: end, manualNumber: meta.manualNumber, articles: meta.articles, docType: meta.docType, people: meta.selectedPeople, facts: meta.selectedFacts };
    setFiles(prev => prev.map(f => {
      if (f.id === currentFileId) return { ...f, extractions: [...f.extractions, newExtraction] };
      return f;
    }));
  };

  const handleDeleteExtraction = (fileId: string, extractionId: string) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, extractions: f.extractions.filter(e => e.id !== extractionId) } : f));
  };

  const handleViewExtraction = async (fileId: string, extractionId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file || !file.file) { alert("Ficheiro não disponível"); return; }
    const ext = file.extractions.find(e => e.id === extractionId);
    if (ext) {
      try { const blobUrl = await generatePartialPdf(file.file, ext.startPage, ext.endPage); window.open(blobUrl, '_blank'); } 
      catch (e) { alert("Erro ao abrir o documento."); }
    }
  };

  const handleSearchEdit = (fileId: string, extractionId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file) {
      const ext = file.extractions.find(e => e.id === extractionId);
      if (ext) setEditingExtraction({ fileId, extraction: ext });
    }
  };

  const confirmSearchEdit = (meta: ExtractionMeta, newRange?: { start: number, end: number }) => {
    if (!editingExtraction) return;
    setFiles(prev => prev.map(f => f.id === editingExtraction.fileId ? { ...f, extractions: f.extractions.map(e => e.id === editingExtraction.extraction.id ? { ...e, startPage: newRange ? newRange.start : e.startPage, endPage: newRange ? newRange.end : e.endPage, manualNumber: meta.manualNumber, articles: meta.articles, docType: meta.docType, people: meta.selectedPeople, facts: meta.selectedFacts } : e) } : f));
    setEditingExtraction(null);
  };

  const handleSearchResultNavigate = (fileId: string, pageNumber: number) => {
    setCurrentFileId(fileId);
    setInitialPageToJump(pageNumber);
    setSearchNavTrigger(prev => prev + 1);
    setViewMode('organizer');
  };

  const handleNextFile = () => {
    const idx = files.findIndex(f => f.id === currentFileId);
    if (idx >= 0 && idx < files.length - 1) { setCurrentFileId(files[idx + 1].id); setInitialPageToJump(1); }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await processAndExport(files, people);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Erro ao exportar.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveProject = () => {
    const dataToSave = { version: 4, date: new Date().toISOString(), people, docTypes, facts, files: files.map(f => ({ ...f, file: null, fileName: f.file ? f.file.name : f.fileName, relativePath: f.file ? f.file.webkitRelativePath : f.relativePath })) };
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Projeto_Juridico_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.people) setPeople(data.people);
        if (data.docTypes) setDocTypes(data.docTypes);
        if (data.facts) setFacts(data.facts); else setFacts(DEFAULT_FACTS);
        if (data.files) {
          const restoredFiles = data.files.map((f: any) => ({ ...f, file: null, extractions: f.extractions.map((ext: any) => ({ ...ext, facts: ext.facts || (ext.fact ? [ext.fact] : ['Prova geral']), articles: ext.articles || '' })) }));
          setFiles(restoredFiles);
          if (availableFiles.length > 0) autoLinkFiles(restoredFiles, availableFiles);
          if (data.files.length > 0) setCurrentFileId(data.files[0].id);
        }
      } catch (err) { alert("Erro ao ler ficheiro de projeto."); }
    };
    input.click();
  };

  const isFileMissing = currentFile && !currentFile.file;
  let initialEditingData: ExtractionMeta | null = null;
  let editingPageRange = { start: 0, end: 0 };
  if (editingExtraction) {
      initialEditingData = { manualNumber: editingExtraction.extraction.manualNumber, articles: editingExtraction.extraction.articles || '', docType: editingExtraction.extraction.docType, selectedPeople: editingExtraction.extraction.people, selectedFacts: editingExtraction.extraction.facts || [] };
      editingPageRange = { start: editingExtraction.extraction.startPage, end: editingExtraction.extraction.endPage };
  }
  let availableReplacements: string[] = [];
  let deleteItemTypeDisplay: DeleteItemType = 'Interveniente';
  if (deleteRequest) {
     if (deleteRequest.type === 'person') { deleteItemTypeDisplay = 'Interveniente'; availableReplacements = people.filter(p => p.name !== deleteRequest.name).map(p => p.name).sort(); }
     else if (deleteRequest.type === 'docType') { deleteItemTypeDisplay = 'Tipo de Documento'; availableReplacements = docTypes.filter(t => t !== deleteRequest.name).sort(); }
     else if (deleteRequest.type === 'fact') { deleteItemTypeDisplay = 'Facto'; availableReplacements = facts.filter(f => f !== deleteRequest.name).sort(); }
  }

  if (files.length === 0 && !isUploadOpen) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-6 max-w-2xl px-4">
          <h1 className="text-3xl font-bold text-slate-800">Organizador de Autos Judiciais</h1>
          <p className="text-slate-500 mx-auto">Uma ferramenta segura para dividir e classificar PDFs de processos.<br/>Para começar, identifique a pasta onde estão os seus ficheiros ou carregue um projeto.</p>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-100 flex flex-col gap-4">
              <div className="relative group w-full">
                  {/* Added spread with any to fix webkitdirectory and directory property errors on input element */}
                  <input type="file" multiple {...({ webkitdirectory: "", directory: "" } as any)} ref={rootFolderInputRef} onChange={(e) => { handleSetRootFolder(e); setIsUploadOpen(true); }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <button className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow font-bold text-lg flex items-center justify-center gap-3 transition-transform transform group-active:scale-95"><FolderOpen className="w-6 h-6" />1. Selecionar Pasta Principal do Processo</button>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400"><div className="h-px bg-gray-200 flex-1"></div>OU<div className="h-px bg-gray-200 flex-1"></div></div>
              <div className="flex gap-3">
                <button onClick={() => setIsUploadOpen(true)} className="flex-1 px-4 py-3 bg-white border border-gray-300 text-slate-600 rounded-lg hover:bg-gray-50 font-medium flex items-center justify-center gap-2"><FileSearch className="w-4 h-4" />Abrir Ficheiro Individual</button>
                <button onClick={handleLoadProject} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium flex items-center justify-center gap-2">Carregar Projeto Guardado</button>
              </div>
          </div>
        </div>
        <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUpload={handleUpload} existingApensos={uniqueApensos} existingAnexos={uniqueAnexos} availableFiles={availableFiles} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar files={files} currentFileId={currentFileId} onSelectFile={(id) => { setCurrentFileId(id); setViewMode('organizer'); }} onOpenUpload={() => setIsUploadOpen(true)} onExport={handleExport} isExporting={isExporting} onDeleteExtraction={handleDeleteExtraction} onEditExtraction={handleSearchEdit} onViewExtraction={handleViewExtraction} onUpdateCategoryName={handleUpdateCategoryName} onSaveProject={handleSaveProject} onLoadProject={handleLoadProject} viewMode={viewMode} onChangeViewMode={setViewMode} onDeleteFile={handleDeleteFile} onDeleteGroup={handleDeleteGroup} />
      <main className="flex-1 relative h-full">
        {viewMode === 'search' ? (
          <SearchDashboard files={files} people={people} docTypes={docTypes} facts={facts} onNavigate={handleSearchResultNavigate} onEdit={handleSearchEdit} />
        ) : (
          currentFile ? (
            !isFileMissing ? (
              <PdfViewer currentFile={currentFile} onAddExtraction={handleAddExtraction} onNextFile={handleNextFile} hasMoreFiles={files.findIndex(f => f.id === currentFileId) < files.length - 1} people={people} onAddPerson={handleAddPerson} onBulkAddPeople={handleBulkAddPeople} onUpdatePerson={handleUpdatePerson} onDeletePerson={handleDeletePerson} docTypes={docTypes} onAddDocType={handleAddDocType} onBulkAddDocTypes={handleBulkAddDocTypes} onDeleteDocType={handleDeleteDocType} onClearAllDocTypes={handleClearAllDocTypes} facts={facts} onAddFact={handleAddFact} onBulkAddFacts={handleBulkAddFacts} onDeleteFact={handleDeleteFact} onUpdateFact={handleUpdateFact} initialPage={initialPageToJump} searchNavTrigger={searchNavTrigger} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full space-y-6 bg-slate-50 p-4">
                  <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-2xl w-full border border-slate-200">
                    <div className="flex justify-center mb-6"><div className="p-4 bg-orange-50 rounded-full"><AlertCircle className="w-12 h-12 text-orange-500" /></div></div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Ligação aos Ficheiros Necessária</h2>
                    <p className="text-gray-600 mb-6">Para retomar o projeto, por favor identifique novamente a <strong>Pasta Principal</strong>.<br/>A app irá procurar os ficheiros automaticamente usando os caminhos originais.</p>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm text-left mb-6 border border-gray-200">
                        <p className="font-semibold text-gray-700 mb-1">Ficheiro em falta:</p>
                        <p className="font-mono text-gray-500 break-all">{currentFile.relativePath || currentFile.fileName}</p>
                    </div>
                    <div className="space-y-4">
                        <div className="relative group">
                            {/* Added spread with any to fix webkitdirectory and directory property errors on input element */}
                            <input type="file" multiple {...({ webkitdirectory: "", directory: "" } as any)} ref={relinkInputRef} onChange={handleSetRootFolder} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <button className="w-full px-8 py-5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg font-bold text-xl flex items-center justify-center gap-3 transition-transform transform group-active:scale-95"><FolderOpen className="w-6 h-6" />Selecionar Pasta Principal do Processo</button>
                        </div>
                    </div>
                    <div className="mt-8 pt-4 border-t border-gray-100"><button onClick={() => setIsUploadOpen(true)} className="text-gray-500 hover:text-blue-600 text-sm underline">Localizar este ficheiro manualmente...</button></div>
                  </div>
              </div>
            )
          ) : ( <div className="flex items-center justify-center h-full text-gray-400">Selecione um ficheiro na barra lateral</div> )
        )}

        {/* Overlay de carregamento para exportação por partes */}
        {isExporting && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center">
             <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm text-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">A Gerar Exportação</h3>
                <p className="text-gray-600 text-sm">
                  Devido ao tamanho do processo, os ficheiros serão divididos em várias partes para segurança.
                </p>
                <p className="mt-4 text-xs text-orange-600 font-bold bg-orange-50 px-3 py-2 rounded-lg">
                  Por favor, autorize múltiplos downloads se o browser solicitar.
                </p>
             </div>
          </div>
        )}
      </main>

      <ExtractionModal isOpen={!!editingExtraction} onClose={() => setEditingExtraction(null)} onConfirm={confirmSearchEdit} pageRange={editingPageRange} people={people} onAddPerson={handleAddPerson} onBulkAddPeople={handleBulkAddPeople} onUpdatePerson={handleUpdatePerson} onDeletePerson={handleDeletePerson} docTypes={docTypes} onAddDocType={handleAddDocType} onBulkAddDocTypes={handleBulkAddDocTypes} onDeleteDocType={handleDeleteDocType} onClearAllDocTypes={handleClearAllDocTypes} facts={facts} onAddFact={handleAddFact} onBulkAddFacts={handleBulkAddFacts} onDeleteFact={handleDeleteFact} onUpdateFact={handleUpdateFact} initialData={initialEditingData} />
      <DeleteConfirmationModal isOpen={!!deleteRequest} onClose={() => setDeleteRequest(null)} itemType={deleteItemTypeDisplay} itemName={deleteRequest?.name || ''} usageCount={deleteUsageCount} availableReplacements={availableReplacements} onConfirmDelete={executeDelete} onConfirmReplace={executeReplace} />
      <GenericConfirmModal isOpen={!!confirmRequest} onClose={() => setConfirmRequest(null)} title={confirmRequest?.title || ''} message={confirmRequest?.message || ''} onConfirm={confirmRequest?.onConfirm || (() => {})} isDestructive={confirmRequest?.isDestructive} />
      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUpload={handleUpload} existingApensos={uniqueApensos} existingAnexos={uniqueAnexos} availableFiles={availableFiles} />
    </div>
  );
};

export default App;
