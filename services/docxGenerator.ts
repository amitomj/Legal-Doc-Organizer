
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, HeadingLevel, AlignmentType, TextRun, PageOrientation, ShadingType, BorderStyle } from "docx";
import { CaseFile, SearchResult } from "../types";
import { sanitizeFilename } from "../constants";

const HEADING_COLOR = "2E74B5";
const TABLE_HEADER_BG = "4F81BD";
const TABLE_HEADER_TEXT = "FFFFFF";
const TABLE_ROW_EVEN_BG = "D0D8E8";
const TABLE_ROW_ODD_BG = "FFFFFF";

const formatArticlesVal = (val: string | undefined): string => {
  if (!val) return "-";
  return val.split(',').map(s => s.trim()).filter(s => s.length > 0).map(s => s.startsWith('#') ? s : `#${s}`).join(', ');
};

const createCell = (content: Paragraph | Paragraph[], widthPercent: number, isHeader: boolean = false, shadingColor: string = "FFFFFF") => {
  return new TableCell({
    children: Array.isArray(content) ? content : [content],
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: isHeader ? TABLE_HEADER_BG : shadingColor, type: ShadingType.CLEAR, color: "auto" },
    verticalAlign: "center",
    margins: { top: 100, bottom: 100, left: 100, right: 100 }
  });
};

const headerText = (text: string) => {
  return new Paragraph({ children: [new TextRun({ text, bold: true, color: TABLE_HEADER_TEXT })], alignment: AlignmentType.CENTER });
};

export const generateWordReport = async (files: CaseFile[]): Promise<Blob> => {
  const autos = files.filter(f => f.category === 'Autos Principais');
  const apensosMap = new Map<string, CaseFile[]>();
  const anexosMap = new Map<string, CaseFile[]>();

  files.filter(f => f.category === 'Apenso').forEach(f => {
    const name = f.categoryName || 'Sem Nome';
    if (!apensosMap.has(name)) apensosMap.set(name, []);
    apensosMap.get(name)?.push(f);
  });

  files.filter(f => f.category === 'Anexo').forEach(f => {
    const name = f.categoryName || 'Sem Nome';
    if (!anexosMap.has(name)) anexosMap.set(name, []);
    anexosMap.get(name)?.push(f);
  });

  const volumeSorter = (a: CaseFile, b: CaseFile) => a.volume.localeCompare(b.volume, undefined, { numeric: true, sensitivity: 'base' });

  const createTableForFiles = (fileList: CaseFile[]) => {
    const sortedFiles = [...fileList].sort(volumeSorter);
    const rows: TableRow[] = [];

    rows.push(new TableRow({
      tableHeader: true,
      children: [
        createCell(headerText("Artigos"), 8, true),
        createCell(headerText("Factos"), 15, true),
        createCell(headerText("Intervenientes"), 17, true),
        createCell(headerText("Tipo / Resumo"), 20, true), // Merged DocType and Summary for space
        createCell(headerText("Página"), 10, true),
        createCell(headerText("Nome do Ficheiro PDF"), 30, true),
      ]
    }));

    let rowIndex = 0;
    sortedFiles.forEach(file => {
      let categorySegment = file.category === 'Autos Principais' ? "Autos_Principais" : (file.categoryName ? sanitizeFilename(file.categoryName) : sanitizeFilename(file.category));
      const volumeSegment = sanitizeFilename(file.volume);

      file.extractions.forEach(ext => {
        const displayNames = [...ext.people].sort((a, b) => a.localeCompare(b));
        const factsDisplay = ext.facts && ext.facts.length > 0 ? ext.facts : ['Prova geral'];
        const allFactsSegment = sanitizeFilename(factsDisplay.join('_'));
        const filename = `${sanitizeFilename(ext.manualNumber)}.${categorySegment}.${volumeSegment}.${sanitizeFilename(ext.docType)}.${allFactsSegment}.pdf`;

        factsDisplay.forEach(fact => {
          const rowColor = rowIndex % 2 === 0 ? TABLE_ROW_ODD_BG : TABLE_ROW_EVEN_BG;
          const peopleParagraphs = displayNames.map(name => new Paragraph({ text: `${name},`, spacing: { after: 60 } }));
          
          const typeSummaryContent = [
            new Paragraph({ children: [new TextRun({ text: ext.docType, bold: true })] }),
            ...(ext.summary ? [new Paragraph({ children: [new TextRun({ text: ext.summary, italics: true, size: 18, color: "666666" })] })] : [])
          ];

          rows.push(new TableRow({
            children: [
              createCell(new Paragraph({ text: formatArticlesVal(ext.articles), alignment: AlignmentType.CENTER }), 8, false, rowColor),
              createCell(new Paragraph(fact), 15, false, rowColor),
              createCell(peopleParagraphs.length > 0 ? peopleParagraphs : [new Paragraph("-")], 17, false, rowColor),
              createCell(typeSummaryContent, 20, false, rowColor),
              createCell(new Paragraph({ text: ext.manualNumber, alignment: AlignmentType.CENTER }), 10, false, rowColor),
              createCell(new Paragraph({ text: filename, style: "Code" }), 30, false, rowColor),
            ]
          }));
          rowIndex++;
        });
      });
    });

    if (rows.length === 1) return [new Paragraph({ children: [new TextRun({ text: "Sem documentos marcados.", italics: true })] })];
    return [new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
      }
    }), new Paragraph({ text: "", spacing: { after: 400 } })];
  };

  const docChildren: any[] = [new Paragraph({ text: "Índice de Documentos Judiciais", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 400 } })];
  if (autos.length > 0) { docChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Autos Principais", color: HEADING_COLOR })] })); docChildren.push(...createTableForFiles(autos)); }
  if (apensosMap.size > 0) {
    docChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Apensos", color: HEADING_COLOR })], spacing: { before: 200 } }));
    Array.from(apensosMap.keys()).sort().forEach(name => { docChildren.push(new Paragraph({ text: name, heading: HeadingLevel.HEADING_2 })); docChildren.push(...createTableForFiles(apensosMap.get(name)!)); });
  }
  if (anexosMap.size > 0) {
    docChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Anexos", color: HEADING_COLOR })], spacing: { before: 200 } }));
    Array.from(anexosMap.keys()).sort().forEach(name => { docChildren.push(new Paragraph({ text: name, heading: HeadingLevel.HEADING_2 })); docChildren.push(...createTableForFiles(anexosMap.get(name)!)); });
  }

  const doc = new Document({ sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } }, children: docChildren }] });
  return await Packer.toBlob(doc);
};

export const generateSearchReport = async (results: SearchResult[]): Promise<Blob> => {
  const rows: TableRow[] = [];
  rows.push(new TableRow({
    tableHeader: true,
    children: [
      createCell(headerText("Artigos"), 8, true),
      createCell(headerText("Factos"), 15, true),
      createCell(headerText("Intervenientes"), 17, true),
      createCell(headerText("Tipo / Resumo"), 20, true),
      createCell(headerText("Página"), 10, true),
      createCell(headerText("Nome do Ficheiro PDF"), 30, true),
    ]
  }));

  results.forEach((res, index) => {
    let categorySegment = res.category === 'Autos Principais' ? "Autos_Principais" : (res.categoryName ? sanitizeFilename(res.categoryName) : sanitizeFilename(res.category));
    const volumeSegment = sanitizeFilename(res.volume);
    const factsSegment = sanitizeFilename(res.facts.join('_'));
    const filename = `${sanitizeFilename(res.manualNumber)}.${categorySegment}.${volumeSegment}.${sanitizeFilename(res.docType)}.${factsSegment}.pdf`;
    const rowColor = index % 2 === 0 ? TABLE_ROW_ODD_BG : TABLE_ROW_EVEN_BG;
    
    const typeSummaryContent = [
      new Paragraph({ children: [new TextRun({ text: res.docType, bold: true })] }),
      ...(res.summary ? [new Paragraph({ children: [new TextRun({ text: res.summary, italics: true, size: 18, color: "666666" })] })] : [])
    ];

    rows.push(new TableRow({
      children: [
        createCell(new Paragraph({ text: formatArticlesVal(res.articles), alignment: AlignmentType.CENTER }), 8, false, rowColor),
        createCell(res.facts.map(f => new Paragraph(f)), 15, false, rowColor),
        createCell(res.people.sort().map(p => new Paragraph(p)), 17, false, rowColor),
        createCell(typeSummaryContent, 20, false, rowColor),
        createCell(new Paragraph({ text: res.manualNumber, alignment: AlignmentType.CENTER }), 10, false, rowColor),
        createCell(new Paragraph({ text: filename, style: "Code" }), 30, false, rowColor),
      ]
    }));
  });

  const doc = new Document({ sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } }, children: [new Paragraph({ text: "Relatório de Pesquisa", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 400 } }), new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })] }] });
  return await Packer.toBlob(doc);
};
