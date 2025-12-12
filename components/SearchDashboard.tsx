import React, { useState, useMemo } from 'react';
import { Search, Filter, FileText, User, FolderOpen, ArrowRight, X, ExternalLink, Eye, List, Pencil, Archive, Hash, LayoutList, ArrowDownAZ, ArrowDown01, CheckCircle2 } from 'lucide-react';
import { CaseFile, Person, SearchResult } from '../types';
import { generatePartialPdf, processAndExportSearchResults } from '../services/pdfProcessing';

interface SearchDashboardProps {
  files: CaseFile[];
  people: Person[];
  docTypes: string[];
  facts: string[];
  onNavigate: (fileId: string, pageNumber: number) => void;
  onEdit: (fileId: string, extractionId: string) => void;
}

type SearchMode = 'process' | 'fact';
type FactSortOrder = 'alpha' | 'numeric';

interface FactGroup {
  factName: string;
  items: (SearchResult & { isHighlighted?: boolean })[];
}

const SearchDashboard: React.FC<SearchDashboardProps> = ({ 
  files, 
  people, 
  docTypes,
  facts,
  onNavigate,
  onEdit
}) => {
  // Mode State
  const [activeTab, setActiveTab] = useState<SearchMode>('process');
  const [factSortOrder, setFactSortOrder] = useState<FactSortOrder>('numeric');

  // Filters State
  const [manualNumFilter, setManualNumFilter] = useState('');
  const [articleFilter, setArticleFilter] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [factFilter, setFactFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState(''); // Format: "Category|Name"
  
  const [isExporting, setIsExporting] = useState(false);

  // 1. Build dynamic list of locations
  const locations = useMemo(() => {
    const locs = new Set<string>();
    locs.add('Autos Principais|');

    files.forEach(f => {
      if (f.category === 'Apenso' && f.categoryName) {
        locs.add(`Apenso|${f.categoryName}`);
      } else if (f.category === 'Anexo' && f.categoryName) {
        locs.add(`Anexo|${f.categoryName}`);
      }
    });
    return Array.from(locs).sort();
  }, [files]);

  // Helper to extract first number from string
  const getFirstNumber = (str: string): number => {
    const match = str.match(/\d+/);
    return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
  };

  // --- LOGIC FOR "PROCESS SEARCH" (Original) ---
  const processResults: SearchResult[] = useMemo(() => {
    if (activeTab !== 'process') return [];

    let filtered: SearchResult[] = [];

    files.forEach(file => {
      // Location Filter
      if (locationFilter) {
        const [cat, name] = locationFilter.split('|');
        if (file.category !== cat) return;
        if (cat !== 'Autos Principais' && file.categoryName !== name) return;
      }

      file.extractions.forEach(ext => {
        // Basic Text Filters
        if (manualNumFilter && !ext.manualNumber.toLowerCase().includes(manualNumFilter.toLowerCase())) return;
        if (articleFilter && !(ext.articles || '').includes(articleFilter)) return;
        
        // Strict Match Filters for Process Mode
        if (docTypeFilter && ext.docType !== docTypeFilter) return;
        if (personFilter && !ext.people.includes(personFilter)) return;
        
        const extFacts = ext.facts && ext.facts.length > 0 ? ext.facts : ['Prova geral'];
        if (factFilter && !extFacts.includes(factFilter)) return;

        filtered.push({
          fileId: file.id,
          extractionId: ext.id,
          volume: file.volume,
          category: file.category,
          categoryName: file.categoryName,
          manualNumber: ext.manualNumber,
          articles: ext.articles, 
          docType: ext.docType,
          people: ext.people,
          facts: extFacts,
          startPage: ext.startPage,
          endPage: ext.endPage
        });
      });
    });

    return filtered;
  }, [files, activeTab, manualNumFilter, articleFilter, docTypeFilter, personFilter, factFilter, locationFilter]);


  // --- LOGIC FOR "FACT SEARCH" (New) ---
  const factGroups: FactGroup[] = useMemo(() => {
    if (activeTab !== 'fact') return [];

    const groups: Map<string, (SearchResult & { isHighlighted?: boolean })[]> = new Map();

    files.forEach(file => {
      // 1. Strict Filters (Page, Article, Location, Specific Fact Name)
      // These filters ALWAYS reduce the dataset
      if (locationFilter) {
        const [cat, name] = locationFilter.split('|');
        if (file.category !== cat) return;
        if (cat !== 'Autos Principais' && file.categoryName !== name) return;
      }

      file.extractions.forEach(ext => {
        if (manualNumFilter && !ext.manualNumber.toLowerCase().includes(manualNumFilter.toLowerCase())) return;
        if (articleFilter && !(ext.articles || '').includes(articleFilter)) return;
        
        const extFacts = ext.facts && ext.facts.length > 0 ? ext.facts : ['Prova geral'];
        
        // Specific Fact Filter (Drop-down) still works as a strict filter if selected
        if (factFilter && !extFacts.includes(factFilter)) return;

        // 2. Logic: Add this extraction to ALL its associated facts
        extFacts.forEach(factName => {
          if (!groups.has(factName)) {
            groups.set(factName, []);
          }

          // Determine Highlight Status based on Person/DocType
          let isHighlighted = false;
          
          // Check Person Filter match
          if (personFilter && ext.people.includes(personFilter)) {
            isHighlighted = true;
          }
          // Check DocType Filter match
          if (docTypeFilter && ext.docType === docTypeFilter) {
            isHighlighted = true;
          }

          groups.get(factName)?.push({
            fileId: file.id,
            extractionId: ext.id,
            volume: file.volume,
            category: file.category,
            categoryName: file.categoryName,
            manualNumber: ext.manualNumber,
            articles: ext.articles, 
            docType: ext.docType,
            people: ext.people,
            facts: extFacts, // Keep all facts for display context
            startPage: ext.startPage,
            endPage: ext.endPage,
            isHighlighted
          });
        });
      });
    });

    // 3. Post-Processing: Filter Groups & Sort Items
    const resultGroups: FactGroup[] = [];

    groups.forEach((items, factName) => {
      // Filter out the GROUP if it doesn't meet the "Contextual" criteria
      // If Person Filter is active, ONLY show facts that have at least one doc with that person
      if (personFilter) {
        const hasMatch = items.some(i => i.people.includes(personFilter));
        if (!hasMatch) return;
      }

      // If DocType Filter is active, ONLY show facts that have at least one doc of that type
      if (docTypeFilter) {
        const hasMatch = items.some(i => i.docType === docTypeFilter);
        if (!hasMatch) return;
      }

      // Sort items within the group: Highlighted first, then by page number
      items.sort((a, b) => {
        if (a.isHighlighted && !b.isHighlighted) return -1;
        if (!a.isHighlighted && b.isHighlighted) return 1;
        return a.manualNumber.localeCompare(b.manualNumber);
      });

      resultGroups.push({
        factName,
        items
      });
    });

    // 4. Sort the Facts (Groups) themselves
    resultGroups.sort((a, b) => {
      if (factSortOrder === 'numeric') {
        const numA = getFirstNumber(a.factName);
        const numB = getFirstNumber(b.factName);
        
        if (numA !== numB) {
          return numA - numB;
        }
        // Fallback to alpha if numbers are same (or max_int)
        return a.factName.localeCompare(b.factName);
      } else {
        return a.factName.localeCompare(b.factName);
      }
    });

    return resultGroups;
  }, [files, activeTab, factSortOrder, manualNumFilter, articleFilter, docTypeFilter, personFilter, factFilter, locationFilter]);


  // Helper functions
  const hasActiveFilters = manualNumFilter || articleFilter || docTypeFilter || personFilter || factFilter || locationFilter;

  const clearFilters = () => {
    setManualNumFilter('');
    setArticleFilter('');
    setDocTypeFilter('');
    setPersonFilter('');
    setFactFilter('');
    setLocationFilter('');
  };

  const handleView = async (fileId: string, startPage: number, endPage: number) => {
    const file = files.find(f => f.id === fileId);
    if (file && file.file) {
      try {
        const blobUrl = await generatePartialPdf(file.file, startPage, endPage);
        window.open(blobUrl, '_blank');
      } catch (e) {
        alert("Erro ao abrir o documento.");
      }
    } else {
      alert("O ficheiro original não está disponível.");
    }
  };

  const handleExportResults = async () => {
    // Determine which dataset to export
    let exportData: SearchResult[] = [];
    
    if (activeTab === 'process') {
      exportData = processResults;
    } else {
      // Flatten fact groups for export
      // Note: This might duplicate items if they appear in multiple facts, 
      // but that is technically correct for a "Fact Based" view export.
      factGroups.forEach(group => {
        exportData.push(...group.items);
      });
    }

    if (exportData.length === 0) return;
    
    setIsExporting(true);
    try {
      await processAndExportSearchResults(files, exportData);
    } catch (e) {
      alert("Erro ao exportar resultados.");
    } finally {
      setIsExporting(false);
    }
  };

  // Render Table Row
  const renderRow = (res: SearchResult, isHighlighted: boolean = false) => (
    <tr key={`${res.extractionId}_${res.fileId}`} className={`transition-colors group border-b border-gray-100 ${isHighlighted ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-blue-50'}`}>
      <td className="px-6 py-3 font-mono font-medium text-blue-600 w-24">
        {res.manualNumber}
      </td>
      <td className="px-6 py-3 font-mono text-xs text-gray-600">
        {res.articles || '-'}
      </td>
      <td className="px-6 py-3 text-gray-800 font-medium">
        {res.docType}
      </td>
      <td className="px-6 py-3 text-gray-600 text-xs">
        <div className="font-bold text-gray-700">
          {res.category === 'Autos Principais' ? 'Autos Principais' : res.categoryName}
        </div>
        <div className="text-gray-500">Vol. {res.volume}</div>
      </td>
      {activeTab === 'process' && (
        <td className="px-6 py-3">
          <div className="flex flex-wrap gap-1">
            {res.facts.map(f => (
              <span key={f} className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] rounded border border-indigo-100">
                {f}
              </span>
            ))}
          </div>
        </td>
      )}
      <td className="px-6 py-3">
        <div className="flex flex-wrap gap-1">
          {res.people.length > 0 ? res.people.map(p => (
            <span key={p} className={`inline-block px-2 py-0.5 text-[10px] rounded border ${isHighlighted && (personFilter === p) ? 'bg-yellow-200 border-yellow-300 text-yellow-900 font-bold' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {p}
            </span>
          )) : <span className="text-gray-300 italic">-</span>}
        </div>
      </td>
      <td className="px-6 py-3 text-right">
        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
            onClick={() => handleView(res.fileId, res.startPage, res.endPage)}
            title="Ver"
            className="text-blue-600 hover:text-blue-800 p-1"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onEdit(res.fileId, res.extractionId)}
            title="Editar"
            className="text-gray-500 hover:text-blue-600 p-1"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );

  const totalResults = activeTab === 'process' 
    ? processResults.length 
    : factGroups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      
      {/* Header / Filters Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm z-10 flex flex-col">
        <div className="p-6 pb-2">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Search className="w-6 h-6 text-blue-600" />
                Pesquisar Processo
              </h2>
              
              <button
                onClick={handleExportResults}
                disabled={totalResults === 0 || isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm font-medium"
              >
                {isExporting ? <span className="animate-spin">⏳</span> : <Archive className="w-4 h-4" />}
                Exportar Resultados
              </button>
            </div>

            {/* TABS */}
            <div className="flex gap-4 border-b border-gray-100 mb-4">
              <button
                onClick={() => setActiveTab('process')}
                className={`flex items-center gap-2 pb-2 px-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'process' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <LayoutList className="w-4 h-4" />
                Pesquisar Processo
              </button>
              <button
                onClick={() => setActiveTab('fact')}
                className={`flex items-center gap-2 pb-2 px-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'fact' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <List className="w-4 h-4" />
                Pesquisar por Facto
              </button>
            </div>

            {/* FILTERS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
              
              {/* Filter: Number */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Página</label>
                <div className="relative">
                  <input
                    type="text"
                    value={manualNumFilter}
                    onChange={(e) => setManualNumFilter(e.target.value)}
                    placeholder="Ex: 154..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none transition-all text-sm"
                  />
                  <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Filter: Article */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Artigo</label>
                <div className="relative">
                  <input
                    type="text"
                    value={articleFilter}
                    onChange={(e) => setArticleFilter(e.target.value)}
                    placeholder="Ex: 12..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none transition-all text-sm"
                  />
                  <Hash className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Filter: Doc Type */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Documento</label>
                <div className="relative">
                  <select
                    value={docTypeFilter}
                    onChange={(e) => setDocTypeFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none appearance-none cursor-pointer text-sm"
                  >
                    <option value="">Todos os Tipos</option>
                    {docTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <FileText className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Filter: People */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Interveniente</label>
                <div className="relative">
                  <select
                    value={personFilter}
                    onChange={(e) => setPersonFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none appearance-none cursor-pointer text-sm"
                  >
                    <option value="">Todos os Intervenientes</option>
                    {people.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                      <option key={p.id} value={p.name}>{p.name} ({p.type})</option>
                    ))}
                  </select>
                  <User className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Filter: Facts */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Facto (Específico)</label>
                <div className="relative">
                  <select
                    value={factFilter}
                    onChange={(e) => setFactFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none appearance-none cursor-pointer text-sm"
                  >
                    <option value="">Todos os Factos</option>
                    {facts.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <List className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Filter: Location */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Localização</label>
                <div className="relative">
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none appearance-none cursor-pointer text-sm"
                  >
                    <option value="">Todo o Processo</option>
                    {locations.map(loc => {
                      const [type, name] = loc.split('|');
                      const label = type === 'Autos Principais' ? type : `${type}: ${name}`;
                      return <option key={loc} value={loc}>{label}</option>
                    })}
                  </select>
                  <FolderOpen className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                </div>
              </div>
            </div>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-auto bg-gray-100 p-6">
        
        {/* Results Info Bar */}
        <div className="mb-4 flex justify-between items-center">
             <div className="flex items-center gap-4">
                <h3 className="font-bold text-gray-700 text-lg">
                  {activeTab === 'process' 
                    ? `${totalResults} Documentos Encontrados` 
                    : `${factGroups.length} Factos Encontrados (${totalResults} docs)`
                  }
                </h3>
                {hasActiveFilters && (
                  <button 
                    onClick={clearFilters}
                    className="text-xs font-bold text-red-500 hover:text-red-700 uppercase tracking-wide flex items-center gap-1 bg-white hover:bg-red-50 border border-red-100 px-2 py-1 rounded transition-colors shadow-sm"
                  >
                    <X className="w-3 h-3" /> Limpar Filtros
                  </button>
                )}
             </div>

             {/* Sorting Controls for Fact Mode */}
             {activeTab === 'fact' && (
                <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
                   <button
                     onClick={() => setFactSortOrder('numeric')}
                     className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 ${factSortOrder === 'numeric' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                     title="Ordenar por número (Ex: Facto 1, Facto 2, Facto 10)"
                   >
                     <ArrowDown01 className="w-3 h-3" /> Numérica
                   </button>
                   <button
                     onClick={() => setFactSortOrder('alpha')}
                     className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 ${factSortOrder === 'alpha' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                     title="Ordenar alfabeticamente"
                   >
                     <ArrowDownAZ className="w-3 h-3" /> Alfabética
                   </button>
                </div>
             )}
        </div>
        
        {/* VIEW 1: PROCESS MODE */}
        {activeTab === 'process' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {totalResults === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Nenhum documento encontrado com os filtros atuais.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-3 font-bold text-gray-600 w-24">Página</th>
                      <th className="px-6 py-3 font-bold text-gray-600">Artigos</th>
                      <th className="px-6 py-3 font-bold text-gray-600">Tipo</th>
                      <th className="px-6 py-3 font-bold text-gray-600">Localização</th>
                      <th className="px-6 py-3 font-bold text-gray-600">Factos</th>
                      <th className="px-6 py-3 font-bold text-gray-600">Intervenientes</th>
                      <th className="px-6 py-3 font-bold text-gray-600 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {processResults.map((res) => renderRow(res))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: FACT MODE */}
        {activeTab === 'fact' && (
          <div className="space-y-6">
            {totalResults === 0 && (
                <div className="p-12 text-center text-gray-400 bg-white rounded-xl shadow-sm">
                  <List className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhum facto encontrado para os critérios selecionados.</p>
                </div>
            )}

            {factGroups.map((group) => (
              <div key={group.factName} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
                 {/* Fact Header */}
                 <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                       <List className="w-5 h-5 text-blue-500" />
                       {group.factName}
                    </h3>
                    <div className="text-xs text-slate-500 font-medium bg-white px-2 py-1 rounded border border-slate-200">
                       {group.items.length} documento(s)
                    </div>
                 </div>

                 {/* Results Table for this Fact */}
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-white border-b border-gray-100 text-xs uppercase text-gray-400">
                          <th className="px-6 py-2 font-bold w-24">Página</th>
                          <th className="px-6 py-2 font-bold">Artigos</th>
                          <th className="px-6 py-2 font-bold">Tipo</th>
                          <th className="px-6 py-2 font-bold">Localização</th>
                          {/* Fact column hidden in Fact Mode as redundant */}
                          <th className="px-6 py-2 font-bold">Intervenientes</th>
                          <th className="px-6 py-2 font-bold text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((res) => renderRow(res, res.isHighlighted))}
                      </tbody>
                    </table>
                 </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default SearchDashboard;