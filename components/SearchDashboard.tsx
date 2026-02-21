
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
  const [activeTab, setActiveTab] = useState<SearchMode>('process');
  const [factSortOrder, setFactSortOrder] = useState<FactSortOrder>('numeric');

  const [manualNumFilter, setManualNumFilter] = useState('');
  const [articleFilter, setArticleFilter] = useState('');
  const [summaryFilter, setSummaryFilter] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [factFilter, setFactFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  
  const [isExporting, setIsExporting] = useState(false);

  const locations = useMemo(() => {
    const locs = new Set<string>();
    locs.add('Autos Principais|');
    files.forEach(f => {
      if (f.category === 'Apenso' && f.categoryName) locs.add(`Apenso|${f.categoryName}`);
      else if (f.category === 'Anexo' && f.categoryName) locs.add(`Anexo|${f.categoryName}`);
    });
    return Array.from(locs).sort();
  }, [files]);

  const getFirstNumber = (str: string): number => {
    const match = str.match(/\d+/);
    return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
  };

  const processResults: SearchResult[] = useMemo(() => {
    if (activeTab !== 'process') return [];
    let filtered: SearchResult[] = [];
    files.forEach(file => {
      if (locationFilter) {
        const [cat, name] = locationFilter.split('|');
        if (file.category !== cat) return;
        if (cat !== 'Autos Principais' && file.categoryName !== name) return;
      }
      file.extractions.forEach(ext => {
        if (manualNumFilter && !ext.manualNumber.toLowerCase().includes(manualNumFilter.toLowerCase())) return;
        if (articleFilter && !(ext.articles || '').includes(articleFilter)) return;
        if (summaryFilter && !ext.summary.toLowerCase().includes(summaryFilter.toLowerCase())) return;
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
          summary: ext.summary || '',
          people: ext.people,
          facts: extFacts,
          startPage: ext.startPage,
          endPage: ext.endPage
        });
      });
    });
    return filtered;
  }, [files, activeTab, manualNumFilter, articleFilter, summaryFilter, docTypeFilter, personFilter, factFilter, locationFilter]);

  const factGroups: FactGroup[] = useMemo(() => {
    if (activeTab !== 'fact') return [];
    const groups: Map<string, (SearchResult & { isHighlighted?: boolean })[]> = new Map();
    files.forEach(file => {
      if (locationFilter) {
        const [cat, name] = locationFilter.split('|');
        if (file.category !== cat) return;
        if (cat !== 'Autos Principais' && file.categoryName !== name) return;
      }
      file.extractions.forEach(ext => {
        if (manualNumFilter && !ext.manualNumber.toLowerCase().includes(manualNumFilter.toLowerCase())) return;
        if (articleFilter && !(ext.articles || '').includes(articleFilter)) return;
        if (summaryFilter && !ext.summary.toLowerCase().includes(summaryFilter.toLowerCase())) return;
        const extFacts = ext.facts && ext.facts.length > 0 ? ext.facts : ['Prova geral'];
        if (factFilter && !extFacts.includes(factFilter)) return;
        extFacts.forEach(factName => {
          if (!groups.has(factName)) groups.set(factName, []);
          let isHighlighted = (personFilter && ext.people.includes(personFilter)) || (docTypeFilter && ext.docType === docTypeFilter);
          groups.get(factName)?.push({
            fileId: file.id,
            extractionId: ext.id,
            volume: file.volume,
            category: file.category,
            categoryName: file.categoryName,
            manualNumber: ext.manualNumber,
            articles: ext.articles, 
            docType: ext.docType,
            summary: ext.summary || '',
            people: ext.people,
            facts: extFacts,
            startPage: ext.startPage,
            endPage: ext.endPage,
            isHighlighted
          });
        });
      });
    });
    const resultGroups: FactGroup[] = [];
    groups.forEach((items, factName) => {
      if (personFilter && !items.some(i => i.people.includes(personFilter))) return;
      if (docTypeFilter && !items.some(i => i.docType === docTypeFilter)) return;
      items.sort((a, b) => {
        if (a.isHighlighted && !b.isHighlighted) return -1;
        if (!a.isHighlighted && b.isHighlighted) return 1;
        return a.manualNumber.localeCompare(b.manualNumber);
      });
      resultGroups.push({ factName, items });
    });
    resultGroups.sort((a, b) => {
      if (factSortOrder === 'numeric') {
        const numA = getFirstNumber(a.factName);
        const numB = getFirstNumber(b.factName);
        if (numA !== numB) return numA - numB;
        return a.factName.localeCompare(b.factName);
      } else return a.factName.localeCompare(b.factName);
    });
    return resultGroups;
  }, [files, activeTab, factSortOrder, manualNumFilter, articleFilter, summaryFilter, docTypeFilter, personFilter, factFilter, locationFilter]);

  const hasActiveFilters = manualNumFilter || articleFilter || summaryFilter || docTypeFilter || personFilter || factFilter || locationFilter;
  const clearFilters = () => { setManualNumFilter(''); setArticleFilter(''); setSummaryFilter(''); setDocTypeFilter(''); setPersonFilter(''); setFactFilter(''); setLocationFilter(''); };

  const handleView = async (fileId: string, startPage: number, endPage: number) => {
    const file = files.find(f => f.id === fileId);
    if (file && file.file) {
      try { const blobUrl = await generatePartialPdf(file.file, startPage, endPage); window.open(blobUrl, '_blank'); } catch (e) { alert("Erro ao abrir."); }
    }
  };

  const handleExportResults = async () => {
    let exportData: SearchResult[] = [];
    if (activeTab === 'process') exportData = processResults;
    else factGroups.forEach(group => exportData.push(...group.items));
    if (exportData.length === 0) return;
    setIsExporting(true);
    try { await processAndExportSearchResults(files, exportData); } finally { setIsExporting(false); }
  };

  const renderRow = (res: SearchResult, isHighlighted: boolean = false) => (
    <tr key={`${res.extractionId}_${res.fileId}`} className={`transition-colors group border-b border-gray-100 ${isHighlighted ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-blue-50'}`}>
      <td className="px-6 py-3 font-mono font-medium text-blue-600 w-24">{res.manualNumber}</td>
      <td className="px-6 py-3 font-mono text-xs text-gray-600">{res.articles || '-'}</td>
      <td className="px-6 py-3 text-gray-800 font-medium">
        <div>{res.docType}</div>
      </td>
      <td className="px-6 py-3 text-gray-500 text-xs italic">
        {res.summary || '-'}
      </td>
      <td className="px-6 py-3 text-gray-600 text-xs">
        <div className="font-bold text-gray-700">{res.category === 'Autos Principais' ? 'Autos Principais' : res.categoryName}</div>
        <div className="text-gray-500">Vol. {res.volume}</div>
      </td>
      {activeTab === 'process' && <td className="px-6 py-3"><div className="flex flex-wrap gap-1">{res.facts.map(f => <span key={f} className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] rounded border border-indigo-100">{f}</span>)}</div></td>}
      <td className="px-6 py-3"><div className="flex flex-wrap gap-1">{res.people.length > 0 ? res.people.map(p => <span key={p} className={`inline-block px-2 py-0.5 text-[10px] rounded border ${isHighlighted && (personFilter === p) ? 'bg-yellow-200 border-yellow-300 text-yellow-900 font-bold' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{p}</span>) : <span className="text-gray-300 italic">-</span>}</div></td>
      <td className="px-6 py-3 text-right">
        <div className="flex justify-end gap-2 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => handleView(res.fileId, res.startPage, res.endPage)} className="text-blue-600 hover:text-blue-800 p-1" title="Ver PDF"><Eye className="w-4 h-4" /></button>
            <button onClick={() => onEdit(res.fileId, res.extractionId)} className="text-gray-500 hover:text-blue-600 p-1" title="Editar"><Pencil className="w-4 h-4" /></button>
        </div>
      </td>
    </tr>
  );

  const totalResults = activeTab === 'process' ? processResults.length : factGroups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="bg-white border-b border-gray-200 shadow-sm z-10 flex flex-col">
        <div className="p-6 pb-2">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Search className="w-6 h-6 text-blue-600" />Pesquisar Processo</h2><button onClick={handleExportResults} disabled={totalResults === 0 || isExporting} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm font-medium">{isExporting ? <span className="animate-spin">⏳</span> : <Archive className="w-4 h-4" />}Exportar Resultados</button></div>
            <div className="flex gap-4 border-b border-gray-100 mb-4">
              <button onClick={() => setActiveTab('process')} className={`flex items-center gap-2 pb-2 px-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'process' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><LayoutList className="w-4 h-4" />Pesquisar Processo</button>
              <button onClick={() => setActiveTab('fact')} className={`flex items-center gap-2 pb-2 px-2 text-sm font-bold transition-colors border-b-2 ${activeTab === 'fact' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><List className="w-4 h-4" />Pesquisar por Facto</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 mb-4">
              <div className="relative"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Página</label><div className="relative"><input type="text" value={manualNumFilter} onChange={(e) => setManualNumFilter(e.target.value)} placeholder="Ex: 154..." className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" /><Filter className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" /></div></div>
              <div className="relative"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Artigo</label><div className="relative"><input type="text" value={articleFilter} onChange={(e) => setArticleFilter(e.target.value)} placeholder="Ex: 12..." className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" /><Hash className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" /></div></div>
              <div className="relative"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Resumo</label><div className="relative"><input type="text" value={summaryFilter} onChange={(e) => setSummaryFilter(e.target.value)} placeholder="Pesquisar resumo..." className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm" /><FileText className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" /></div></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label><div className="relative"><select value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none appearance-none cursor-pointer text-sm"><option value="">Todos</option>{docTypes.map(type => <option key={type} value={type}>{type}</option>)}</select><FileText className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" /></div></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Interveniente</label><div className="relative"><select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none appearance-none cursor-pointer text-sm"><option value="">Todos</option>{people.sort((a,b) => a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select><User className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" /></div></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Facto</label><div className="relative"><select value={factFilter} onChange={(e) => setFactFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none appearance-none cursor-pointer text-sm"><option value="">Todos</option>{facts.map(f => <option key={f} value={f}>{f}</option>)}</select><List className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" /></div></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Localização</label><div className="relative"><select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none appearance-none cursor-pointer text-sm"><option value="">Todo o Processo</option>{locations.map(loc => { const [type, name] = loc.split('|'); return <option key={loc} value={loc}>{type === 'Autos Principais' ? type : `${type}: ${name}`}</option> })}</select><FolderOpen className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" /></div></div>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-100 p-6">
        <div className="mb-4 flex justify-between items-center"><div className="flex items-center gap-4"><h3 className="font-bold text-gray-700 text-lg">{activeTab === 'process' ? `${totalResults} Docs` : `${factGroups.length} Factos (${totalResults} docs)`}</h3>{hasActiveFilters && <button onClick={clearFilters} className="text-xs font-bold text-red-500 hover:text-red-700 uppercase flex items-center gap-1 bg-white border border-red-100 px-2 py-1 rounded shadow-sm"><X className="w-3 h-3" /> Limpar</button>}</div>{activeTab === 'fact' && <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1"><button onClick={() => setFactSortOrder('numeric')} className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 ${factSortOrder === 'numeric' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}><ArrowDown01 className="w-3 h-3" /> Numérica</button><button onClick={() => setFactSortOrder('alpha')} className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 ${factSortOrder === 'alpha' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}><ArrowDownAZ className="w-3 h-3" /> Alfabética</button></div>}</div>
        
        {activeTab === 'process' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {totalResults === 0 ? <div className="p-12 text-center text-gray-400"><Search className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>Nenhum resultado.</p></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-3 font-bold text-gray-600 w-24">Página</th>
                      <th className="px-6 py-3 font-bold text-gray-600">Artigos</th>
                      <th className="px-6 py-3 font-bold text-gray-600">Tipo</th>
                      <th className="px-6 py-3 font-bold text-gray-600">Resumo</th>
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

        {activeTab === 'fact' && (
          <div className="space-y-6">
            {totalResults === 0 && <div className="p-12 text-center text-gray-400 bg-white rounded-xl shadow-sm"><List className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>Nenhum resultado.</p></div>}
            {factGroups.map((group) => (
              <div key={group.factName} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><List className="w-5 h-5 text-blue-500" />{group.factName}</h3>
                  <div className="text-xs text-slate-500 font-medium bg-white px-2 py-1 rounded border border-slate-200">{group.items.length} doc(s)</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-white border-b border-gray-100 text-xs uppercase text-gray-400">
                        <th className="px-6 py-2 font-bold w-24">Página</th>
                        <th className="px-6 py-2 font-bold">Artigos</th>
                        <th className="px-6 py-2 font-bold">Tipo</th>
                        <th className="px-6 py-2 font-bold">Resumo</th>
                        <th className="px-6 py-2 font-bold">Localização</th>
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
