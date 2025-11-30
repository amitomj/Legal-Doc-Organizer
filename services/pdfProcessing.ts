import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { CaseFile, Extraction, Person } from '../types';
import { sanitizeFilename } from '../constants';
import { generateWordReport } from './docxGenerator';

export const processAndExport = async (files: CaseFile[], people: Person[]) => {
  const zip = new JSZip();

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
    if (caseFile.category === 'Autos Principais') {
      categorySegment = "Autos_Principais";
    } else {
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