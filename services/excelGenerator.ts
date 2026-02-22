
import ExcelJS from 'exceljs';
import { CaseFile } from '../types';
import { sanitizeFilename } from '../constants';

interface FlatRow {
  artigo: string;
  facto: string;
  interveniente: string;
  tipoProva: string;
  resumo: string; // New
  pagina: string;
  nomeFicheiro: string;
}

export const generateExcelReport = async (files: CaseFile[]): Promise<Blob> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Dados Processuais');

  worksheet.columns = [
    { header: 'Artigos', key: 'artigo', width: 12 },
    { header: 'Factos', key: 'facto', width: 25 },
    { header: 'Intervenientes', key: 'interveniente', width: 25 },
    { header: 'Tipo de Prova', key: 'tipoProva', width: 20 },
    { header: 'Resumo', key: 'resumo', width: 30 }, // New column
    { header: 'Página', key: 'pagina', width: 12 },
    { header: 'Nome do Ficheiro PDF', key: 'nomeFicheiro', width: 50 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };

  const flatRows: FlatRow[] = [];
  files.forEach(file => {
    let categorySegment = file.category === 'Autos Principais' ? "Autos_Principais" : (file.categoryName ? sanitizeFilename(file.categoryName) : sanitizeFilename(file.category));
    const volumeSegment = sanitizeFilename(file.volume);
    file.extractions.forEach(ext => {
      let articleList = ext.articles ? ext.articles.split(',').map(s => s.trim()).filter(s => s.length > 0) : ['-'];
      let factList = (ext.facts && ext.facts.length > 0) ? ext.facts : ['Prova geral'];
      let peopleList = (ext.people && ext.people.length > 0) ? ext.people : ['-'];
      const allFactsSegment = sanitizeFilename(factList.join('_'));
      const filename = `${sanitizeFilename(ext.manualNumber)}.${categorySegment}.${volumeSegment}.${sanitizeFilename(ext.docType)}.${allFactsSegment}.pdf`;

      articleList.forEach(artigo => {
        factList.forEach(facto => {
          peopleList.forEach(pessoa => {
            flatRows.push({
              artigo: artigo === '-' ? '' : artigo,
              facto,
              interveniente: pessoa === '-' ? '' : pessoa,
              tipoProva: ext.docType,
              resumo: ext.summary || '',
              pagina: ext.manualNumber,
              nomeFicheiro: filename
            });
          });
        });
      });
    });
  });

  flatRows.sort((a, b) => {
    if (!a.artigo && b.artigo) return 1;
    if (a.artigo && !b.artigo) return -1;
    if (!a.artigo && !b.artigo) return 0;
    return a.artigo.localeCompare(b.artigo, undefined, { numeric: true, sensitivity: 'base' });
  });

  flatRows.forEach(row => worksheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
