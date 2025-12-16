import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, Flag, BookmarkPlus, FileWarning, RotateCw } from 'lucide-react';
import { CaseFile, ExtractionMeta, Person, PersonType } from '../types';
import ExtractionModal from './ExtractionModal';

// Set worker to the matching version for react-pdf 7.7.3
// Using 3.11.174
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

interface PdfViewerProps {
  currentFile: CaseFile;
  onAddExtraction: (start: number, end: number, meta: ExtractionMeta) => void;
  onNextFile: () => void;
  hasMoreFiles: boolean;
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
  onUpdateFact: (oldFact: string, newFact: string) => void;
  initialPage?: number | null;
  searchNavTrigger?: number; // Used to force navigation if page is same
}

const PdfViewer: React.FC<PdfViewerProps> = ({ 
  currentFile, 
  onAddExtraction, 
  onNextFile, 
  hasMoreFiles,
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
  onUpdateFact,
  initialPage,
  searchNavTrigger
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [inputPage, setInputPage] = useState<string>('1'); // State for the input field
  const [startPage, setStartPage] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);

  // Reset state when file changes or initialPage updates
  useEffect(() => {
    let targetPage = 1;
    if (initialPage && initialPage > 0) {
      targetPage = initialPage;
    }
    setPageNumber(targetPage);
    setInputPage(String(targetPage));
    setStartPage(null);
    setNumPages(0);
    setRotation(0);
  }, [currentFile.id, initialPage, searchNavTrigger]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    // Safety check: if initial page > numPages, clamp it
    if (initialPage && initialPage > numPages) {
      setPageNumber(numPages);
      setInputPage(String(numPages));
    }
  }

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => {
      const newPage = prevPageNumber + offset;
      const clamped = Math.min(Math.max(newPage, 1), numPages);
      setInputPage(String(clamped));
      return clamped;
    });
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Handle direct input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow digits only
    if (/^\d*$/.test(val)) {
      setInputPage(val);
    }
  };

  // Handle Enter key in input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const page = parseInt(inputPage);
      if (page >= 1 && page <= numPages) {
        setPageNumber(page);
        e.currentTarget.blur(); // Remove focus so arrow keys work for navigation again
      } else {
        // Revert to current page if invalid
        setInputPage(String(pageNumber));
      }
    }
  };

  // Handle blur (focus lost)
  const handleInputBlur = () => {
    const page = parseInt(inputPage);
    if (page >= 1 && page <= numPages) {
      setPageNumber(page);
    } else {
      setInputPage(String(pageNumber));
    }
  };

  const handleMarkStart = () => {
    setStartPage(pageNumber);
  };

  const handleMarkEnd = () => {
    if (startPage !== null) {
      if (pageNumber < startPage) {
        alert("A página final não pode ser anterior à página inicial.");
        return;
      }
      setIsModalOpen(true);
    }
  };

  const confirmExtraction = (meta: ExtractionMeta, newRange?: { start: number, end: number }) => {
    if (startPage) {
      // Use the range from the modal if edited, otherwise use the selection
      const s = newRange ? newRange.start : startPage;
      const e = newRange ? newRange.end : pageNumber;
      
      onAddExtraction(s, e, meta);
      setStartPage(null);
      setIsModalOpen(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) return;
      
      // Prevent page navigation if user is typing in the page input or any other input
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        changePage(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        changePage(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, isModalOpen]);

  return (
    <div className="flex flex-col h-full bg-slate-100">
      
      {/* Viewer Toolbar */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-gray-500">
             {currentFile.category} 
             {currentFile.categoryName && ` (${currentFile.categoryName})`}
             <span className="mx-2 text-gray-300">|</span>
             Volume: {currentFile.volume}
          </div>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button 
            onClick={() => changePage(-1)} 
            disabled={pageNumber <= 1}
            className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center mx-1">
            <input
              type="text"
              value={inputPage}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
              className="w-12 text-center text-sm font-mono border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none px-1 py-0.5"
            />
            <span className="text-sm font-mono text-gray-500 ml-1">
              / {numPages || '-'}
            </span>
          </div>

          <button 
            onClick={() => changePage(1)} 
            disabled={pageNumber >= numPages}
            className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
           {/* Rotate Button */}
           <button
             onClick={handleRotate}
             title="Rodar Página"
             className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
           >
             <RotateCw className="w-5 h-5" />
           </button>

           <div className="h-6 w-px bg-gray-300 mx-2"></div>

           {/* Action Buttons */}
           {!startPage ? (
             <button 
               onClick={handleMarkStart}
               className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
             >
               <Flag className="w-4 h-4" />
               <span className="text-sm font-bold">Marcar Início (Pg {pageNumber})</span>
             </button>
           ) : (
             <div className="flex items-center gap-2">
                <span className="text-xs text-orange-600 font-bold uppercase tracking-wider bg-orange-100 px-2 py-1 rounded">
                  A selecionar desde a pg {startPage}
                </span>
                <button 
                  onClick={() => setStartPage(null)}
                  className="px-3 py-2 text-gray-500 hover:text-red-500 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleMarkEnd}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  <span className="text-sm font-bold">Marcar Fim (Pg {pageNumber})</span>
                </button>
             </div>
           )}
        </div>
      </div>

      {/* PDF Scroll Area */}
      <div className="flex-1 overflow-auto bg-slate-200 flex justify-center p-8 relative">
        <div className="shadow-2xl">
          <Document
            file={currentFile.file}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(error) => console.error("Erro ao carregar PDF:", error)}
            loading={
              <div className="flex items-center gap-2 text-gray-500 bg-white p-4 rounded shadow">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                A carregar PDF...
              </div>
            }
            error={
              <div className="bg-red-50 p-6 rounded-lg text-red-600 flex flex-col items-center">
                <FileWarning className="w-10 h-10 mb-2"/>
                <p>Erro ao carregar o ficheiro.</p>
                <p className="text-xs mt-2 text-red-400">Verifique a consola para mais detalhes.</p>
              </div>
            }
          >
            <Page 
              pageNumber={pageNumber} 
              scale={scale} 
              rotate={rotation}
              renderTextLayer={false} 
              renderAnnotationLayer={false}
              className="bg-white"
              width={Math.min(window.innerWidth * 0.6, 800)} 
            />
          </Document>
        </div>
      </div>

      {/* Footer Navigation */}
      {hasMoreFiles && (
        <div className="bg-white border-t p-3 flex justify-end">
             <button 
               onClick={onNextFile}
               className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium px-4 py-2 hover:bg-blue-50 rounded transition-colors"
             >
               Próximo Ficheiro (Volume) <ChevronRight className="w-4 h-4" />
             </button>
        </div>
      )}

      {/* Modal */}
      <ExtractionModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmExtraction}
        pageRange={{ start: startPage || 0, end: pageNumber }}
        people={people}
        onAddPerson={onAddPerson}
        onBulkAddPeople={onBulkAddPeople}
        onUpdatePerson={onUpdatePerson}
        onDeletePerson={onDeletePerson}
        docTypes={docTypes}
        onAddDocType={onAddDocType}
        onBulkAddDocTypes={onBulkAddDocTypes}
        onDeleteDocType={onDeleteDocType}
        facts={facts}
        onAddFact={onAddFact}
        onBulkAddFacts={onBulkAddFacts}
        onDeleteFact={onDeleteFact}
        onUpdateFact={onUpdateFact}
      />
    </div>
  );
};

export default PdfViewer;