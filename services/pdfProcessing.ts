
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { CaseFile, Extraction, Person, SearchResult } from '../types';
import { sanitizeFilename } from '../constants';
import { generateWordReport, generateSearchReport } from './docxGenerator';
import { generateExcelReport } from './excelGenerator';

const MAX_EXTRACTIONS_PER_ZIP = 40;

interface ExportTask {
  caseFile: CaseFile;
  extraction: Extraction;
}

const downloadBlob = (content: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const processAndExport = async (files: CaseFile[], people: Person[]) => {
  const allTasks: ExportTask[] = [];
  files.forEach(f => { f.extractions.forEach(e => { allTasks.push({ caseFile: f, extraction: e }); }); });
  if (allTasks.length === 0) return;

  const batches: ExportTask[][] = [];
  for (let i = 0; i < allTasks.length; i += MAX_EXTRACTIONS_PER_ZIP) {
    batches.push(allTasks.slice(i, i + MAX_EXTRACTIONS_PER_ZIP));
  }

  const totalBatches = batches.length;
  const dateStr = new Date().toISOString().slice(0, 10);

  for (let bIndex = 0; bIndex < totalBatches; bIndex++) {
    const currentBatch = batches[bIndex];
    const zip = new JSZip();
    const jsonExportData: any[] = [];
    if (bIndex === 0) {
      try {
        zip.file("00_Indice_Geral.docx", await generateWordReport(files));
        zip.file("00_Indice_Geral_Excel.xlsx", await generateExcelReport(files));
      } catch (e) { console.error(e); }
    }

    const tasksByFileId: Record<string, ExportTask[]> = {};
    currentBatch.forEach(task => { if (!tasksByFileId[task.caseFile.id]) tasksByFileId[task.caseFile.id] = []; tasksByFileId[task.caseFile.id].push(task); });

    for (const fileId in tasksByFileId) {
      const fileTasks = tasksByFileId[fileId];
      const caseFile = fileTasks[0].caseFile;
      if (!caseFile.file) continue;
      try {
        const arrayBuffer = await caseFile.file.arrayBuffer();
        const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const categorySegment = caseFile.category === 'Autos Principais' ? "Autos_Principais" : sanitizeFilename(caseFile.categoryName || caseFile.category);
        const volumeSegment = sanitizeFilename(caseFile.volume);
        const locationName = caseFile.category === 'Autos Principais' ? 'Autos Principais' : (caseFile.categoryName || caseFile.category);

        for (const task of fileTasks) {
          const { extraction } = task;
          let newPdf = await PDFDocument.create();
          if (extraction.people?.length) { newPdf.setSubject(`Intervenientes: ${extraction.people.join(', ')}`); newPdf.setKeywords(extraction.people); }
          newPdf.setTitle(`${extraction.docType} - ${extraction.manualNumber}${extraction.summary ? ` (${extraction.summary})` : ''}`);
          
          const pageIndices: number[] = [];
          for (let i = extraction.startPage; i <= extraction.endPage; i++) { if (i - 1 >= 0 && i - 1 < srcDoc.getPageCount()) pageIndices.push(i - 1); }
          if (pageIndices.length > 0) {
            const copiedPages = await newPdf.copyPages(srcDoc, pageIndices);
            copiedPages.forEach((page) => newPdf.addPage(page));
            const pdfBytes = await newPdf.save({ useObjectStreams: false });
            const extractionFacts = extraction.facts?.length ? extraction.facts : ['Prova geral'];
            const filename = `${sanitizeFilename(extraction.manualNumber)}.${categorySegment}.${volumeSegment}.${sanitizeFilename(extraction.docType)}.${sanitizeFilename(extractionFacts.join('_'))}.pdf`;

            jsonExportData.push({
              numero_manual: extraction.manualNumber,
              artigos: extraction.articles || "",
              tipo_prova: extraction.docType,
              resumo: extraction.summary || "", // New field
              factos: extractionFacts,
              intervenientes: extraction.people,
              nome_ficheiro: filename,
              localizacao: { designacao: locationName, volume: caseFile.volume, paginas_originais: `${extraction.startPage}-${extraction.endPage}` }
            });

            zip.folder(`01_Organizacao_Processual/${categorySegment}`)?.file(filename, pdfBytes);
            zip.folder(`02_Por_Tipo_Documental/${sanitizeFilename(extraction.docType)}`)?.file(filename, pdfBytes);
            extractionFacts.forEach(fact => { zip.folder(`03_Por_Facto/${sanitizeFilename(fact)}`)?.file(filename, pdfBytes); });
            extraction.people?.forEach(person => { zip.folder(`04_Intervenientes/${sanitizeFilename(person)}`)?.file(filename, pdfBytes); });
          }
        }
      } catch (e) { console.error(e); }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    zip.file(`dados_lote_${bIndex + 1}.json`, JSON.stringify(jsonExportData, null, 2));
    const zipBlob = await zip.generateAsync({ type: "blob", streamFiles: true, compression: "STORE" });
    downloadBlob(zipBlob, `Processo_Completo_${dateStr}${totalBatches > 1 ? `_Parte_${bIndex + 1}_de_${totalBatches}` : ''}.zip`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};

export const generatePartialPdf = async (file: File, startPage: number, endPage: number): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  try {
    const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const newPdf = await PDFDocument.create();
    const pageIndices: number[] = [];
    for (let i = startPage; i <= endPage; i++) { if (i - 1 >= 0 && i - 1 < srcDoc.getPageCount()) pageIndices.push(i - 1); }
    if (pageIndices.length > 0) { const copiedPages = await newPdf.copyPages(srcDoc, pageIndices); copiedPages.forEach((page) => newPdf.addPage(page)); }
    const pdfBytes = await newPdf.save();
    return URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
  } finally { }
};

export const processAndExportSearchResults = async (files: CaseFile[], searchResults: SearchResult[]) => {
  if (searchResults.length === 0) return;
  const batches: SearchResult[][] = [];
  for (let i = 0; i < searchResults.length; i += MAX_EXTRACTIONS_PER_ZIP) { batches.push(searchResults.slice(i, i + MAX_EXTRACTIONS_PER_ZIP)); }
  const totalBatches = batches.length;
  const dateStr = new Date().toISOString().slice(0, 10);
  for (let bIndex = 0; bIndex < totalBatches; bIndex++) {
    const currentBatch = batches[bIndex];
    const zip = new JSZip();
    if (bIndex === 0) { try { zip.file("Relatorio_Pesquisa_Geral.docx", await generateSearchReport(searchResults)); } catch (e) { console.error(e); } }
    const docsFolder = zip.folder("Documentos_Pesquisa");
    const resultsByFileId = currentBatch.reduce((acc, res) => { if (!acc[res.fileId]) acc[res.fileId] = []; acc[res.fileId].push(res); return acc; }, {} as Record<string, SearchResult[]>);
    for (const fileId in resultsByFileId) {
      const file = files.find(f => f.id === fileId);
      if (!file || !file.file) continue;
      try {
        const buffer = await file.file.arrayBuffer();
        const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        for (const res of resultsByFileId[fileId]) {
          let newPdf = await PDFDocument.create();
          const pageIndices: number[] = [];
          for (let i = res.startPage; i <= res.endPage; i++) { if (i - 1 >= 0 && i - 1 < srcDoc.getPageCount()) pageIndices.push(i - 1); }
          if (pageIndices.length > 0) {
            const copiedPages = await newPdf.copyPages(srcDoc, pageIndices);
            copiedPages.forEach((page) => newPdf.addPage(page));
            const pdfBytes = await newPdf.save({ useObjectStreams: false });
            const categorySegment = res.category === 'Autos Principais' ? "Autos_Principais" : sanitizeFilename(res.categoryName || res.category);
            const filename = `${sanitizeFilename(res.manualNumber)}.${categorySegment}.${sanitizeFilename(res.volume)}.${sanitizeFilename(res.docType)}.${sanitizeFilename(res.facts.join('_'))}.pdf`;
            docsFolder?.file(filename, pdfBytes);
          }
        }
      } catch (e) { console.error(e); }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const content = await zip.generateAsync({ type: "blob", streamFiles: true, compression: "STORE" });
    downloadBlob(content, `Resultados_Pesquisa_${dateStr}${totalBatches > 1 ? `_Parte_${bIndex + 1}_de_${totalBatches}` : ''}.zip`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
};
