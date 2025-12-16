import React, { useState, useEffect } from 'react';
import { File, Folder, Database, Trash2, Download, PlusCircle, ChevronDown, ChevronRight, Pencil, Check, X, Archive, LayoutList, Search, Eye } from 'lucide-react';
import { CaseFile, DocCategory } from '../types';
import { ViewMode } from '../App';

interface SidebarProps {
  files: CaseFile[];
  currentFileId: string | null;
  onSelectFile: (id: string) => void;
  onOpenUpload: () => void;
  onExport: () => void;
  isExporting: boolean;
  onDeleteExtraction: (fileId: string, extractionId: string) => void;
  onEditExtraction: (fileId: string, extractionId: string) => void;
  onViewExtraction: (fileId: string, extractionId: string) => void;
  onUpdateCategoryName: (oldName: string, newName: string, category: DocCategory) => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteGroup: (category: DocCategory, name: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  files, 
  currentFileId, 
  onSelectFile, 
  onOpenUpload,
  onExport,
  isExporting,
  onDeleteExtraction,
  onEditExtraction,
  onViewExtraction,
  onUpdateCategoryName,
  onSaveProject,
  onLoadProject,
  viewMode,
  onChangeViewMode,
  onDeleteFile,
  onDeleteGroup
}) => {
  
  const [expandedSection, setExpandedSection] = useState<DocCategory | null>('Autos Principais');
  const [editingCategory, setEditingCategory] = useState<{name: string, category: DocCategory} | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  // Auto-expand the section of the current file
  useEffect(() => {
    if (currentFileId) {
      const currentFile = files.find(f => f.id === currentFileId);
      if (currentFile) {
        setExpandedSection(currentFile.category);
      }
    }
  }, [currentFileId, files]);

  const toggleSection = (section: DocCategory) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Grouping logic
  const autos = files.filter(f => f.category === 'Autos Principais');
  
  const groupFiles = (category: DocCategory) => {
    const groups: {[key: string]: CaseFile[]} = {};
    files.filter(f => f.category === category).forEach(f => {
      const name = f.categoryName || 'Sem Nome';
      if (!groups[name]) groups[name] = [];
      groups[name].push(f);
    });
    return groups;
  };

  const apensosGroups = groupFiles('Apenso');
  const anexosGroups = groupFiles('Anexo');

  // Natural Sort for Volumes (1, 2, 10 instead of 1, 10, 2)
  const sortFilesByVolume = (fileList: CaseFile[]) => {
    return [...fileList].sort((a, b) => {
      return a.volume.localeCompare(b.volume, undefined, { numeric: true, sensitivity: 'base' });
    });
  };

  const handleStartEdit = (name: string, category: DocCategory) => {
    setEditingCategory({ name, category });
    setEditNameValue(name);
  };

  const handleSaveEdit = () => {
    if (editingCategory && editNameValue.trim() && editNameValue !== editingCategory.name) {
      onUpdateCategoryName(editingCategory.name, editNameValue.trim(), editingCategory.category);
    }
    setEditingCategory(null);
  };

  const renderFileList = (fileList: CaseFile[]) => {
    const sorted = sortFilesByVolume(fileList);
    return sorted.map(file => {
      const isMissing = !file.file; // Check if file link is broken (from saved project)
      const isActive = currentFileId === file.id && viewMode === 'organizer';
      return (
        <div key={file.id} className="mb-2 pl-4 group/item">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => onSelectFile(file.id)}
              className={`flex-1 text-left p-2 rounded-lg flex items-start gap-2 transition-all text-sm ${isActive ? 'bg-blue-600 shadow-lg ring-1 ring-blue-400' : 'bg-slate-800 hover:bg-slate-700'}`}
            >
              <File className={`w-3.5 h-3.5 mt-0.5 opacity-70 ${isMissing ? 'text-red-400' : ''}`} />
              <div className="flex-1 min-w-0">
                <div className={`font-semibold truncate ${isMissing ? 'text-red-300' : ''}`}>
                  Volume: {file.volume} {isMissing && '(Requer Ficheiro)'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">{file.category === 'Autos Principais' ? 'Autos' : (file.categoryName || file.category)}</div>
              </div>
              {file.extractions.length > 0 && (
                  <span className="bg-green-500 text-white text-[9px] font-bold px-1.5 rounded-full min-w-[18px] text-center">
                    {file.extractions.length}
                  </span>
              )}
            </button>
            
            {/* Delete File Button */}
            <button 
              type="button"
              onClick={(e) => { 
                e.stopPropagation(); 
                e.preventDefault();
                onDeleteFile(file.id); 
              }}
              className="p-2 text-slate-500 hover:text-white bg-transparent hover:bg-red-600 rounded transition-colors"
              title="Eliminar este ficheiro"
            >
               <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Extractions List for Active File */}
          {isActive && file.extractions.length > 0 && (
            <div className="ml-3 mt-1 space-y-1 border-l border-slate-700 pl-2">
              {file.extractions.map(ext => (
                <div key={ext.id} className="flex justify-between items-center text-[11px] text-slate-300 p-1 hover:bg-slate-800 rounded">
                  <div className="flex-1 truncate cursor-default">
                    <span className="font-mono text-orange-300 mr-1">#{ext.manualNumber}</span>
                    <span className="text-slate-400">{ext.docType}</span>
                  </div>
                  
                  {/* Action Icons */}
                  <div className="flex items-center gap-1">
                     <button 
                       type="button"
                       title="Ver Documento"
                       onClick={(e) => { e.stopPropagation(); onViewExtraction(file.id, ext.id); }}
                       className="text-slate-500 hover:text-blue-400 p-0.5 rounded"
                     >
                       <Eye className="w-3 h-3" />
                     </button>
                     <button 
                       type="button"
                       title="Editar Documento"
                       onClick={(e) => { e.stopPropagation(); onEditExtraction(file.id, ext.id); }}
                       className="text-slate-500 hover:text-yellow-400 p-0.5 rounded"
                     >
                       <Pencil className="w-3 h-3" />
                     </button>
                     <button 
                       type="button"
                       title="Eliminar Documento"
                       onClick={(e) => { e.stopPropagation(); onDeleteExtraction(file.id, ext.id); }}
                       className="text-slate-500 hover:text-red-400 p-0.5 rounded"
                     >
                       <Trash2 className="w-3 h-3" />
                     </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  const renderSection = (title: string, category: DocCategory, icon: React.ReactNode, count: number, content: React.ReactNode) => (
    <div className="border-b border-slate-800">
      <button 
        onClick={() => toggleSection(category)}
        className={`w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-slate-800 transition-colors ${expandedSection === category ? 'text-blue-400 bg-slate-800/50' : 'text-slate-300'}`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{title}</span>
          {count > 0 && <span className="bg-slate-700 text-xs px-1.5 rounded-full text-slate-400">{count}</span>}
        </div>
        {expandedSection === category ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
      </button>
      
      {expandedSection === category && (
        <div className="bg-slate-900/50 p-2 animate-in slide-in-from-top-2 duration-200">
          {content}
        </div>
      )}
    </div>
  );

  const totalExtractions = files.reduce((acc, f) => acc + f.extractions.length, 0);

  return (
    <div className="w-80 bg-slate-900 text-slate-100 flex flex-col h-full shadow-xl z-20">
      
      {/* Header & Tabs */}
      <div className="bg-slate-950 border-b border-slate-800">
        <div className="p-4 flex justify-between items-center pb-2">
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Organizador</h1>
            <p className="text-[10px] text-slate-500">Documentos Judiciais</p>
          </div>
          <button 
            onClick={onOpenUpload}
            className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors"
            title="Adicionar PDF"
          >
            <PlusCircle className="w-5 h-5" />
          </button>
        </div>

        {/* View Toggles */}
        <div className="grid grid-cols-2 px-2 pb-2 gap-1">
          <button
            onClick={() => onChangeViewMode('organizer')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded-t-lg transition-colors ${viewMode === 'organizer' ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:bg-slate-900'}`}
          >
            <LayoutList className="w-4 h-4" />
            Organizar
          </button>
          
          {/* Using anchor tag for Search to allow "Right Click -> Open in New Tab" */}
          <a
            href="?view=search"
            onClick={(e) => { 
                e.preventDefault(); 
                onChangeViewMode('search'); 
            }}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded-t-lg transition-colors cursor-pointer ${viewMode === 'search' ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:bg-slate-900'}`}
          >
            <Search className="w-4 h-4" />
            Pesquisar
          </a>
        </div>
      </div>

      {/* Accordion List */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        
        {/* Autos Principais */}
        {renderSection(
          "Autos Principais", 
          "Autos Principais", 
          <Database className="w-4 h-4 text-blue-400" />, 
          autos.length,
          autos.length > 0 ? renderFileList(autos) : <div className="p-2 text-xs text-slate-500 italic text-center">Sem volumes carregados.</div>
        )}

        {/* Apensos */}
        {renderSection(
          "Apensos", 
          "Apenso", 
          <Folder className="w-4 h-4 text-orange-400" />, 
          Object.keys(apensosGroups).length,
          Object.keys(apensosGroups).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(apensosGroups).sort((a,b) => a[0].localeCompare(b[0])).map(([name, groupFiles]) => (
                <div key={name} className="group/groupheader">
                   <div className="flex items-center justify-between px-2 py-1 text-xs font-bold text-orange-200 uppercase tracking-wider group">
                      {editingCategory?.name === name && editingCategory.category === 'Apenso' ? (
                        <div className="flex items-center gap-1 w-full">
                          <input 
                            value={editNameValue} 
                            onChange={(e) => setEditNameValue(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded px-1 text-white"
                            autoFocus
                          />
                          <button onClick={handleSaveEdit}><Check className="w-3 h-3 text-green-400"/></button>
                          <button onClick={() => setEditingCategory(null)}><X className="w-3 h-3 text-red-400"/></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                           <div className="flex items-center gap-2 overflow-hidden">
                             <span className="truncate">{name}</span>
                             <button onClick={() => handleStartEdit(name, 'Apenso')} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white"><Pencil className="w-3 h-3"/></button>
                           </div>
                           
                           {/* Delete Group Button */}
                           <button 
                             type="button"
                             onClick={(e) => { 
                               e.stopPropagation(); 
                               e.preventDefault();
                               onDeleteGroup('Apenso', name); 
                             }}
                             className="text-slate-500 hover:bg-red-600 hover:text-white p-1 rounded transition-colors"
                             title="Eliminar este Apenso e todos os ficheiros"
                           >
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                        </div>
                      )}
                   </div>
                   {renderFileList(groupFiles)}
                </div>
              ))}
            </div>
          ) : <div className="p-2 text-xs text-slate-500 italic text-center">Sem apensos.</div>
        )}

        {/* Anexos */}
        {renderSection(
          "Anexos", 
          "Anexo", 
          <File className="w-4 h-4 text-gray-400" />, 
          Object.keys(anexosGroups).length,
          Object.keys(anexosGroups).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(anexosGroups).sort((a,b) => a[0].localeCompare(b[0])).map(([name, groupFiles]) => (
                <div key={name} className="group/groupheader">
                   <div className="flex items-center justify-between px-2 py-1 text-xs font-bold text-gray-300 uppercase tracking-wider group">
                      {editingCategory?.name === name && editingCategory.category === 'Anexo' ? (
                        <div className="flex items-center gap-1 w-full">
                          <input 
                            value={editNameValue} 
                            onChange={(e) => setEditNameValue(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded px-1 text-white"
                            autoFocus
                          />
                          <button onClick={handleSaveEdit}><Check className="w-3 h-3 text-green-400"/></button>
                          <button onClick={() => setEditingCategory(null)}><X className="w-3 h-3 text-red-400"/></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                           <div className="flex items-center gap-2 overflow-hidden">
                              <span className="truncate">{name}</span>
                              <button onClick={() => handleStartEdit(name, 'Anexo')} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white"><Pencil className="w-3 h-3"/></button>
                           </div>
                           
                           {/* Delete Group Button */}
                           <button 
                             type="button"
                             onClick={(e) => { 
                                e.stopPropagation(); 
                                e.preventDefault();
                                onDeleteGroup('Anexo', name); 
                             }}
                             className="text-slate-500 hover:bg-red-600 hover:text-white p-1 rounded transition-colors"
                             title="Eliminar este Anexo e todos os ficheiros"
                           >
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                        </div>
                      )}
                   </div>
                   {renderFileList(groupFiles)}
                </div>
              ))}
            </div>
          ) : <div className="p-2 text-xs text-slate-500 italic text-center">Sem anexos.</div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 bg-slate-950 border-t border-slate-700 space-y-2">
         {/* Export Button */}
         <button 
           onClick={onExport}
           disabled={totalExtractions === 0 || isExporting}
           className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg font-bold"
         >
           {isExporting ? <span className="animate-spin">⏳</span> : <Archive className="w-5 h-5" />}
           <span>Exportar Tudo</span>
         </button>
         
         {/* Save/Load Project */}
         <div className="grid grid-cols-2 gap-2 mt-2">
            <button 
              onClick={onSaveProject}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded flex items-center justify-center gap-1"
            >
              <Download className="w-3 h-3" /> Guardar Proj.
            </button>
            <button 
              onClick={onLoadProject}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded flex items-center justify-center gap-1"
            >
              <Download className="w-3 h-3 rotate-180" /> Carregar Proj.
            </button>
         </div>
      </div>
    </div>
  );
};

export default Sidebar;