import ExcelJS from 'exceljs';
import { CaseFile } from '../types';
import { sanitizeFilename } from '../constants';

interface FlatRow {
  artigo: string;
  facto: string;
  interveniente: string;
  tipoProva: string;
  pagina: string;
  nomeFicheiro: string;
}

export const generateExcelReport = async (files: CaseFile[]): Promise<Blob> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Dados Processuais');

  // Define Columns
  worksheet.columns = [
    { header: 'Artigos', key: 'artigo', width: 15 },
    { header: 'Factos', key: 'facto', width: 30 },
    { header: 'Intervenientes', key: 'interveniente', width: 30 },
    { header: 'Tipo de Prova', key: 'tipoProva', width: 20 },
    { header: 'Página', key: 'pagina', width: 15 },
    { header: 'Nome do Ficheiro PDF', key: 'nomeFicheiro', width: 50 },
  ];

  // Header Styling
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F81BD' } // Matching the Blue from Word
  };

  const flatRows: FlatRow[] = [];

  // Iterate and flatten data
  files.forEach(file => {
    // Determine category segment for filename logic (must match PDF logic)
    let categorySegment = "";
    if (file.category === 'Autos Principais') {
      categorySegment = "Autos_Principais";
    } else {
      categorySegment = file.categoryName ? sanitizeFilename(file.categoryName) : sanitizeFilename(file.category);
    }
    const volumeSegment = sanitizeFilename(file.volume);

    file.extractions.forEach(ext => {
      // 1. Prepare Data Lists
      
      // Articles: Split by comma, trim. If empty, use placeholder
      let articleList: string[] = [];
      if (ext.articles) {
        articleList = ext.articles.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }
      if (articleList.length === 0) articleList = ['-'];

      // Facts: Use array. If empty, use placeholder
      let factList = (ext.facts && ext.facts.length > 0) ? ext.facts : ['Prova geral'];
      
      // People: Use array. If empty, use placeholder
      let peopleList = (ext.people && ext.people.length > 0) ? ext.people : ['-'];

      // Filename construction
      const allFactsSegment = sanitizeFilename(factList.join('_'));
      const filename = `${sanitizeFilename(ext.manualNumber)}.${categorySegment}.${volumeSegment}.${sanitizeFilename(ext.docType)}.${allFactsSegment}.pdf`;

      // 2. Cartesian Product (Cross Join) logic
      // Create a row for every combination of Article x Fact x Person
      articleList.forEach(artigo => {
        factList.forEach(facto => {
          peopleList.forEach(pessoa => {
            flatRows.push({
              artigo: artigo === '-' ? '' : artigo, // Display empty string in Excel if placeholder
              facto: facto,
              interveniente: pessoa === '-' ? '' : pessoa,
              tipoProva: ext.docType,
              pagina: ext.manualNumber,
              nomeFicheiro: filename
            });
          });
        });
      });
    });
  });

  // 3. Sort by Artigos
  // Natural sort for strings like "1", "2", "10"
  flatRows.sort((a, b) => {
    // Move empty articles to bottom
    if (!a.artigo && b.artigo) return 1;
    if (a.artigo && !b.artigo) return -1;
    if (!a.artigo && !b.artigo) return 0;

    // Remove non-numeric chars for comparison if possible, or just use localeCompare with numeric option
    return a.artigo.localeCompare(b.artigo, undefined, { numeric: true, sensitivity: 'base' });
  });

  // 4. Add rows to worksheet
  flatRows.forEach(row => {
    worksheet.addRow(row);
  });

  // Write to blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
