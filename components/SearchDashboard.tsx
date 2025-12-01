import React, { useState, useMemo } from 'react';
import { Search, Filter, FileText, User, FolderOpen, ArrowRight, X, ExternalLink, Eye, List, Pencil, Archive } from 'lucide-react';
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

const SearchDashboard: React.FC<SearchDashboardProps> = ({ 
  files, 
  people, 
  docTypes,
  facts,
  onNavigate,
  onEdit
}) => {
  // Filters State
  const [manualNumFilter, setManualNumFilter] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [factFilter, setFactFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState(''); // Format: "Category|Name"
  const [isExporting, setIsExporting] = useState(false);

  // 1. Build dynamic list of locations (Autos, specific Apensos, specific Anexos)
  const locations = useMemo(() => {
    const locs = new Set<string>();
    locs.add('Autos Principais|'); // Base

    files.forEach(f => {
      if (f.category === 'Apenso' && f.categoryName) {
        locs.add(`Apenso|${f.categoryName}`);
      } else if (f.category === 'Anexo' && f.categoryName) {
        locs.add(`Anexo|${f.categoryName}`);
      }
    });
    return Array.from(locs).sort();
  }, [files]);

  // 2. Filter Logic
  const results: SearchResult[] = useMemo(() => {
    let filtered: SearchResult[] = [];

    files.forEach(file => {
      // 2.1 Location Filter
      if (locationFilter) {
        const [cat, name] = locationFilter.split('|');
        if (file.category !== cat) return;
        if (cat !== 'Autos Principais' && file.categoryName !== name) return;
      }

      file.extractions.forEach(ext => {
        // 2.2 Manual Number Filter (Partial match, case insensitive)
        if (manualNumFilter && !ext.manualNumber.toLowerCase().includes(manualNumFilter.toLowerCase())) {
          return;
        }

        // 2.3 Doc Type Filter (Exact match if selected)
        if (docTypeFilter && ext.docType !== docTypeFilter) {
          return;
        }

        // 2.4 Person Filter
        if (personFilter) {
           if (!ext.people.includes(personFilter)) {
             return;
           }
        }

        // 2.5 Fact Filter
        if (factFilter) {
          const extFacts = ext.facts || ['Prova geral'];
          if (!extFacts.includes(factFilter)) {
            return;
          }
        }

        filtered.push({
          fileId: file.id,
          extractionId: ext.id,
          volume: file.volume,
          category: file.category,
          categoryName: file.categoryName,
          manualNumber: ext.manualNumber,
          docType: ext.docType,
          people: ext.people,
          facts: ext.facts || ['Prova geral'],
          startPage: ext.startPage,
          endPage: ext.endPage
        });
      });
    });

    return filtered;
  }, [files, manualNumFilter, docTypeFilter, personFilter, factFilter, locationFilter]);

  const hasActiveFilters = manualNumFilter || docTypeFilter || personFilter || factFilter || locationFilter;

  const clearFilters = () => {
    setManualNumFilter('');
    setDocTypeFilter('');
    setPersonFilter('');
    setFactFilter('');
    setLocationFilter('');
  };

  const handleView = async (fileId: string, startPage: number, endPage: number) => {
    const file = files.find(f => f.id === fileId);
    
    if (file && file.file) {
      try {
        // Generate a new temporary PDF containing ONLY the specific pages
        const blobUrl = await generatePartialPdf(file.file, startPage, endPage);
        window.open(blobUrl, '_blank');
      } catch (e) {
        console.error("Erro ao gerar PDF parcial", e);
        alert("Erro ao abrir o documento.");
      }
    } else {
      alert("O ficheiro original não está disponível para abrir no navegador.");
    }
  };

  const handleExportResults = async () => {
    if (results.length === 0) return;
    setIsExporting(true);
    try {
      await processAndExportSearchResults(files, results);
    } catch (e) {
      console.error(e);
      alert("Erro ao exportar resultados.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      
      {/* Header / Filters Section */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm z-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Search className="w-6 h-6 text-blue-600" />
            Pesquisar Processo
          </h2>
          
          <button
            onClick={handleExportResults}
            disabled={results.length === 0 || isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm font-medium"
          >
             {isExporting ? <span className="animate-spin">⏳</span> : <Archive className="w-4 h-4" />}
             Exportar Resultados
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Filter: Number */}
          <div className="relative">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">N.º Manual</label>
            <div className="relative">
              <input
                type="text"
                value={manualNumFilter}
                onChange={(e) => setManualNumFilter(e.target.value)}
                placeholder="Ex: 154..."
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
              />
              <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Filter: Doc Type */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Documento</label>
            <div className="relative">
              <select
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none appearance-none cursor-pointer"
              >
                <option value="">Todos os Tipos</option>
                {docTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <FileText className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Filter: People */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Interveniente</label>
            <div className="relative">
              <select
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none appearance-none cursor-pointer"
              >
                <option value="">Todos os Intervenientes</option>
                {people.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                  <option key={p.id} value={p.name}>{p.name} ({p.type})</option>
                ))}
              </select>
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Filter: Facts */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Facto</label>
            <div className="relative">
              <select
                value={factFilter}
                onChange={(e) => setFactFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none appearance-none cursor-pointer"
              >
                <option value="">Todos os Factos</option>
                {facts.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <List className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Filter: Location */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Localização</label>
            <div className="relative">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none appearance-none cursor-pointer"
              >
                <option value="">Todo o Processo</option>
                {locations.map(loc => {
                  const [type, name] = loc.split('|');
                  const label = type === 'Autos Principais' ? type : `${type}: ${name}`;
                  return <option key={loc} value={loc}>{label}</option>
                })}
              </select>
              <FolderOpen className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
             <div className="flex items-center gap-4">
                <h3 className="font-semibold text-gray-700">
                  {results.length} Documento(s) Encontrado(s)
                </h3>
                {hasActiveFilters && (
                  <button 
                    onClick={clearFilters}
                    className="text-xs font-bold text-red-500 hover:text-red-700 uppercase tracking-wide flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                  >
                    <X className="w-3 h-3" /> Limpar Filtros
                  </button>
                )}
             </div>
             
             {!hasActiveFilters && results.length > 0 && (
               <span className="text-xs text-gray-400 italic">A mostrar todos os registos</span>
             )}
          </div>
          
          {results.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Nenhum documento encontrado com os filtros atuais.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 font-bold text-gray-600 w-20">N.º</th>
                    <th className="px-6 py-3 font-bold text-gray-600">Tipo</th>
                    <th className="px-6 py-3 font-bold text-gray-600">Localização</th>
                    <th className="px-6 py-3 font-bold text-gray-600">Factos</th>
                    <th className="px-6 py-3 font-bold text-gray-600">Intervenientes</th>
                    <th className="px-6 py-3 font-bold text-gray-600 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.map((res) => (
                    <tr key={res.extractionId} className="hover:bg-blue-50 transition-colors group">
                      <td className="px-6 py-4 font-mono font-medium text-blue-600">
                        {res.manualNumber}
                      </td>
                      <td className="px-6 py-4 text-gray-800 font-medium">
                        {res.docType}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        <div className="text-xs uppercase font-bold text-gray-400 mb-0.5">
                          {res.category === 'Autos Principais' ? 'Autos' : res.categoryName}
                        </div>
                        <div className="font-medium">Volume {res.volume}</div>
                        <div className="text-xs text-gray-400">Pág. {res.startPage}-{res.endPage}</div>
                      </td>
                       <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {res.facts.map(f => (
                            <span key={f} className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-100">
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {res.people.length > 0 ? res.people.map(p => (
                            <span key={p} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">
                              {p}
                            </span>
                          )) : <span className="text-gray-300 italic">-</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                           <button 
                            onClick={() => handleView(res.fileId, res.startPage, res.endPage)}
                            title="Ver documento individual"
                            className="inline-flex items-center gap-2 text-white bg-blue-500 hover:bg-blue-600 font-medium px-3 py-2 rounded-lg transition-colors shadow-sm"
                          >
                            <Eye className="w-4 h-4" />
                            Ver
                          </button>
                          <button 
                            onClick={() => onEdit(res.fileId, res.extractionId)}
                            title="Editar classificação"
                            className="inline-flex items-center gap-2 text-blue-700 bg-blue-100 hover:bg-blue-200 font-medium px-3 py-2 rounded-lg transition-colors shadow-sm"
                          >
                            <Pencil className="w-4 h-4" />
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchDashboard;