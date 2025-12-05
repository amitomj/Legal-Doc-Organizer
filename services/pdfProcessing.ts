import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { CaseFile, Extraction, Person, SearchResult } from '../types';
import { sanitizeFilename } from '../constants';
import { generateWordReport, generateSearchReport } from './docxGenerator';

export const processAndExport = async (files: CaseFile[], people: Person[]) => {
  const zip = new JSZip();
  
  // Array to hold the JSON data for export
  const jsonExportData: any[] = [];

  // Generate Word Report
  try {
    const wordBlob = await generateWordReport(files);
    zip.file("00_Indice_Geral.docx", wordBlob);
  } catch (e) {
    console.error("Failed to generate Word report", e);
  }

  for (const caseFile of files) {
    if (caseFile.extractions.length === 0) continue;
    if (!caseFile.file) continue;

    // Load the original PDF into memory
    const arrayBuffer = await caseFile.file.arrayBuffer();
    const srcDoc = await PDFDocument.load(arrayBuffer);

    // Identify the "b" part of the name (Category Name)
    let categorySegment = "";
    // Human readable name for JSON location
    let locationName = ""; 

    if (caseFile.category === 'Autos Principais') {
      categorySegment = "Autos_Principais";
      locationName = "Autos Principais";
    } else {
      locationName = caseFile.categoryName || caseFile.category;
      categorySegment = caseFile.categoryName ? sanitizeFilename(caseFile.categoryName) : sanitizeFilename(caseFile.category);
    }

    const volumeSegment = sanitizeFilename(caseFile.volume);

    for (const extraction of caseFile.extractions) {
      // Create a new PDF for this extraction
      const newPdf = await PDFDocument.create();
      
      // Embed Metadata with People
      if (extraction.people && extraction.people.length > 0) {
        newPdf.setSubject(`Intervenientes: ${extraction.people.join(', ')}`);
        newPdf.setKeywords(extraction.people);
      }
      newPdf.setTitle(`${extraction.docType} - ${extraction.manualNumber}`);
      
      // Calculate indices (0-based)
      const pageIndices = [];
      for (let i = extraction.startPage; i <= extraction.endPage; i++) {
        if (i - 1 >= 0 && i - 1 < srcDoc.getPageCount()) {
          pageIndices.push(i - 1);
        }
      }

      if (pageIndices.length === 0) continue;

      const copiedPages = await newPdf.copyPages(srcDoc, pageIndices);
      copiedPages.forEach((page) => newPdf.addPage(page));

      const pdfBytes = await newPdf.save();

      // Determine Facts for Filename (Joined)
      const extractionFacts = extraction.facts && extraction.facts.length > 0 
        ? extraction.facts 
        : ['Prova geral'];

      const factsSegment = sanitizeFilename(extractionFacts.join('_'));

      // Structure filename: a.b.c.d.e (e = facts)
      const filename = `${sanitizeFilename(extraction.manualNumber)}.${categorySegment}.${volumeSegment}.${sanitizeFilename(extraction.docType)}.${factsSegment}.pdf`;

      // --- ADD TO JSON DATA ---
      jsonExportData.push({
        numero_manual: extraction.manualNumber,
        artigos: extraction.articles || "",
        tipo_prova: extraction.docType,
        factos: extractionFacts,
        intervenientes: extraction.people,
        nome_ficheiro: filename,
        localizacao: {
          designacao: locationName,
          volume: caseFile.volume,
          paginas_originais: `${extraction.startPage}-${extraction.endPage}`
        }
      });

      // 1. Structure by Category (Function 1)
      const structPath = `01_Organizacao_Processual/${categorySegment}`;
      zip.folder(structPath)?.file(filename, pdfBytes);

      // 2. Structure by Doc Type (Function 2)
      const typePath = `02_Por_Tipo_Documental/${sanitizeFilename(extraction.docType)}`;
      zip.folder(typePath)?.file(filename, pdfBytes);

      // 3. Structure by Fact (Function 3 - New)
      for (const fact of extractionFacts) {
        const factPath = `03_Por_Facto/${sanitizeFilename(fact)}`;
        zip.folder(factPath)?.file(filename, pdfBytes);
      }
    }
  }

  // Add JSON file to ZIP
  zip.file("dados_exportacao.json", JSON.stringify(jsonExportData, null, 2));

  // Generate zip
  const content = await zip.generateAsync({ type: "blob" });
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Processo_Completo_${dateStr}.zip`;

  // Manual save using DOM
  const url = window.URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Generates a temporary Blob URL containing ONLY the pages specified in the range.
 * Used for "Ver" functionality in Search Dashboard.
 */
export const generatePartialPdf = async (file: File, startPage: number, endPage: number): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();

  const pageIndices = [];
  for (let i = startPage; i <= endPage; i++) {
    if (i - 1 >= 0 && i - 1 < srcDoc.getPageCount()) {
      pageIndices.push(i - 1);
    }
  }

  if (pageIndices.length > 0) {
    const copiedPages = await newPdf.copyPages(srcDoc, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));
  }

  const pdfBytes = await newPdf.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
};

/**
 * Exports Search Results:
 * 1. Word Document with filtered table
 * 2. Folder with partial PDFs of the search results
 */
export const processAndExportSearchResults = async (files: CaseFile[], searchResults: SearchResult[]) => {
  if (searchResults.length === 0) return;

  const zip = new JSZip();

  // 1. Generate Search Word Report
  try {
    const wordBlob = await generateSearchReport(searchResults);
    zip.file("Relatorio_Pesquisa.docx", wordBlob);
  } catch (e) {
    console.error("Failed to generate Search Word report", e);
  }

  // 2. Generate Partial PDFs for results
  const docsFolder = zip.folder("Documentos_Pesquisa");
  
  for (const res of searchResults) {
     const file = files.find(f => f.id === res.fileId);
     if (!file || !file.file) continue;

     // Load original PDF
     const arrayBuffer = await file.file.arrayBuffer();
     const srcDoc = await PDFDocument.load(arrayBuffer);
     const newPdf = await PDFDocument.create();

     // Copy only relevant pages
     const pageIndices = [];
     for (let i = res.startPage; i <= res.endPage; i++) {
        if (i - 1 >= 0 && i - 1 < srcDoc.getPageCount()) {
          pageIndices.push(i - 1);
        }
     }

     if (pageIndices.length === 0) continue;

     const copiedPages = await newPdf.copyPages(srcDoc, pageIndices);
     copiedPages.forEach((page) => newPdf.addPage(page));

     const pdfBytes = await newPdf.save();

     // Construct Filename
     let categorySegment = "";
     if (res.category === 'Autos Principais') {
       categorySegment = "Autos_Principais";
     } else {
       categorySegment = res.categoryName ? sanitizeFilename(res.categoryName) : sanitizeFilename(res.category);
     }
     const volumeSegment = sanitizeFilename(res.volume);
     const factsSegment = sanitizeFilename(res.facts.join('_'));
     
     const filename = `${sanitizeFilename(res.manualNumber)}.${categorySegment}.${volumeSegment}.${sanitizeFilename(res.docType)}.${factsSegment}.pdf`;
     
     docsFolder?.file(filename, pdfBytes);
  }

  // Generate zip
  const content = await zip.generateAsync({ type: "blob" });
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `Resultados_Pesquisa_${dateStr}.zip`;

  const url = window.URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};