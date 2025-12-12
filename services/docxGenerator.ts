import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, HeadingLevel, AlignmentType, TextRun, PageOrientation, ShadingType, BorderStyle } from "docx";
import { CaseFile, SearchResult } from "../types";
import { sanitizeFilename } from "../constants";

const HEADING_COLOR = "2E74B5";

// Table Styles matching the image
const TABLE_HEADER_BG = "4F81BD"; // Medium Blue
const TABLE_HEADER_TEXT = "FFFFFF"; // White
const TABLE_ROW_EVEN_BG = "D0D8E8"; // Light Blue/Gray
const TABLE_ROW_ODD_BG = "FFFFFF"; // White

// Helper to format articles with hash prefix
const formatArticlesVal = (val: string | undefined): string => {
  if (!val) return "-";
  return val.split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s.startsWith('#') ? s : `#${s}`)
    .join(', ');
};

// Helper to create a styled cell
const createCell = (content: Paragraph | Paragraph[], widthPercent: number, isHeader: boolean = false, shadingColor: string = "FFFFFF") => {
  return new TableCell({
    children: Array.isArray(content) ? content : [content],
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: {
      fill: isHeader ? TABLE_HEADER_BG : shadingColor,
      type: ShadingType.CLEAR,
      color: "auto",
    },
    verticalAlign: "center",
    margins: {
      top: 100,
      bottom: 100,
      left: 100,
      right: 100,
    }
  });
};

// Helper for header text
const headerText = (text: string) => {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: TABLE_HEADER_TEXT })],
    alignment: AlignmentType.CENTER
  });
};

export const generateWordReport = async (files: CaseFile[]): Promise<Blob> => {
  // Group files by category structure
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

  // Sort function for volumes (Natural Sort: 1, 2, 10)
  const volumeSorter = (a: CaseFile, b: CaseFile) => {
    return a.volume.localeCompare(b.volume, undefined, { numeric: true, sensitivity: 'base' });
  };

  // Helper to create a section table
  const createTableForFiles = (fileList: CaseFile[]) => {
    // Sort files by volume
    const sortedFiles = [...fileList].sort(volumeSorter);
    
    const rows: TableRow[] = [];

    // Header Row
    // Requested Order: Artigos, Factos, Intervenientes, Tipo de prova, Página, Nome do ficheiro pdf
    rows.push(new TableRow({
      tableHeader: true,
      children: [
        createCell(headerText("Artigos"), 10, true),
        createCell(headerText("Factos"), 20, true),
        createCell(headerText("Intervenientes"), 20, true),
        createCell(headerText("Tipo de Prova"), 15, true),
        createCell(headerText("Página"), 10, true),
        createCell(headerText("Nome do Ficheiro PDF"), 25, true),
      ]
    }));

    let rowIndex = 0;

    sortedFiles.forEach(file => {
      // Re-derive category segment for filename generation
      let categorySegment = "";
      if (file.category === 'Autos Principais') {
        categorySegment = "Autos_Principais";
      } else {
        categorySegment = file.categoryName ? sanitizeFilename(file.categoryName) : sanitizeFilename(file.category);
      }
      const volumeSegment = sanitizeFilename(file.volume);

      file.extractions.forEach(ext => {
        
        // Sort names alphabetically (A-Z) strictly
        const displayNames = [...ext.people].sort((a, b) => a.localeCompare(b));
        
        // Determine facts list
        const factsDisplay = ext.facts && ext.facts.length > 0 ? ext.facts : ['Prova geral'];

        // Reconstruct filename (includes all facts joined)
        const allFactsSegment = sanitizeFilename(factsDisplay.join('_'));
        const filename = `${sanitizeFilename(ext.manualNumber)}.${categorySegment}.${volumeSegment}.${sanitizeFilename(ext.docType)}.${allFactsSegment}.pdf`;

        // Create a row for EACH fact
        factsDisplay.forEach(fact => {
          // Re-generate people paragraphs for each row instance to ensure clean document structure
          const peopleParagraphs = displayNames.map(name => new Paragraph({ text: `${name},`, spacing: { after: 60 } }));
          
          const rowColor = rowIndex % 2 === 0 ? TABLE_ROW_ODD_BG : TABLE_ROW_EVEN_BG;

          rows.push(new TableRow({
            children: [
              createCell(new Paragraph({ text: formatArticlesVal(ext.articles), alignment: AlignmentType.CENTER }), 10, false, rowColor),
              createCell(new Paragraph(fact), 20, false, rowColor),
              createCell(peopleParagraphs.length > 0 ? peopleParagraphs : [new Paragraph("-")], 20, false, rowColor),
              createCell(new Paragraph(ext.docType), 15, false, rowColor),
              createCell(new Paragraph({ text: ext.manualNumber, alignment: AlignmentType.CENTER }), 10, false, rowColor),
              createCell(new Paragraph({ text: filename, style: "Code" }), 25, false, rowColor),
            ]
          }));
          
          rowIndex++;
        });
      });
    });

    if (rows.length === 1) {
        return [new Paragraph({ children: [new TextRun({ text: "Sem documentos marcados.", italics: true })], spacing: { after: 200 } })];
    }

    return [new Table({
      rows: rows,
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

  const docChildren: any[] = [
    new Paragraph({
      text: "Índice de Documentos Judiciais",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    })
  ];

  // 1. Autos Principais
  if (autos.length > 0) {
    docChildren.push(new Paragraph({ 
      heading: HeadingLevel.HEADING_1, 
      children: [new TextRun({ text: "Autos Principais", color: HEADING_COLOR })]
    }));
    docChildren.push(...createTableForFiles(autos));
  }

  // 2. Apensos
  if (apensosMap.size > 0) {
    docChildren.push(new Paragraph({ 
      heading: HeadingLevel.HEADING_1, 
      children: [new TextRun({ text: "Apensos", color: HEADING_COLOR })],
      spacing: { before: 200 } 
    }));
    const sortedApensos = Array.from(apensosMap.keys()).sort();
    sortedApensos.forEach(name => {
      docChildren.push(new Paragraph({ text: name, heading: HeadingLevel.HEADING_2 }));
      docChildren.push(...createTableForFiles(apensosMap.get(name)!));
    });
  }

  // 3. Anexos
  if (anexosMap.size > 0) {
    docChildren.push(new Paragraph({ 
      heading: HeadingLevel.HEADING_1, 
      children: [new TextRun({ text: "Anexos", color: HEADING_COLOR })],
      spacing: { before: 200 } 
    }));
    const sortedAnexos = Array.from(anexosMap.keys()).sort();
    sortedAnexos.forEach(name => {
      docChildren.push(new Paragraph({ text: name, heading: HeadingLevel.HEADING_2 }));
      docChildren.push(...createTableForFiles(anexosMap.get(name)!));
    });
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            orientation: PageOrientation.LANDSCAPE,
          },
        },
      },
      children: docChildren
    }]
  });

  return await Packer.toBlob(doc);
};

// --- SEARCH REPORT GENERATOR ---
export const generateSearchReport = async (results: SearchResult[]): Promise<Blob> => {
  const rows: TableRow[] = [];

  // Header
  rows.push(new TableRow({
    tableHeader: true,
    children: [
      createCell(headerText("Artigos"), 10, true),
      createCell(headerText("Factos"), 20, true),
      createCell(headerText("Intervenientes"), 20, true),
      createCell(headerText("Tipo de Prova"), 15, true),
      createCell(headerText("Página"), 10, true),
      createCell(headerText("Nome do Ficheiro PDF"), 25, true),
    ]
  }));

  results.forEach((res, index) => {
    // Reconstruct filename for search report
    let categorySegment = "";
    if (res.category === 'Autos Principais') {
      categorySegment = "Autos_Principais";
    } else {
      categorySegment = res.categoryName ? sanitizeFilename(res.categoryName) : sanitizeFilename(res.category);
    }
    const volumeSegment = sanitizeFilename(res.volume);
    const factsSegment = sanitizeFilename(res.facts.join('_'));
    const filename = `${sanitizeFilename(res.manualNumber)}.${categorySegment}.${volumeSegment}.${sanitizeFilename(res.docType)}.${factsSegment}.pdf`;

    const factsParagraphs = res.facts.map(f => new Paragraph({ text: f, spacing: { after: 40 } }));
    const peopleParagraphs = res.people.sort().map(p => new Paragraph({ text: `${p},`, spacing: { after: 40 } }));

    const rowColor = index % 2 === 0 ? TABLE_ROW_ODD_BG : TABLE_ROW_EVEN_BG;

    rows.push(new TableRow({
      children: [
        createCell(new Paragraph({ text: formatArticlesVal(res.articles), alignment: AlignmentType.CENTER }), 10, false, rowColor),
        createCell(factsParagraphs, 20, false, rowColor),
        createCell(peopleParagraphs.length > 0 ? peopleParagraphs : [new Paragraph("-")], 20, false, rowColor),
        createCell(new Paragraph(res.docType), 15, false, rowColor),
        createCell(new Paragraph({ text: res.manualNumber, alignment: AlignmentType.CENTER }), 10, false, rowColor),
        createCell(new Paragraph({ text: filename, style: "Code" }), 25, false, rowColor),
      ]
    }));
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            orientation: PageOrientation.LANDSCAPE,
          },
        },
      },
      children: [
        new Paragraph({
          text: "Relatório de Pesquisa - Organizador de Autos",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        new Table({
          rows: rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "888888" },
          }
        })
      ]
    }]
  });

  return await Packer.toBlob(doc);
};