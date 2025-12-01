import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, HeadingLevel, AlignmentType, TextRun } from "docx";
import { CaseFile, SearchResult } from "../types";
import { sanitizeFilename } from "../constants";

const HEADING_COLOR = "2E74B5";

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
    rows.push(new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ children: [new Paragraph({ text: "Num.", bold: true })], width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
        new TableCell({ children: [new Paragraph({ text: "Volume", bold: true })], width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
        new TableCell({ children: [new Paragraph({ text: "Tipo de Prova", bold: true })], width: { size: 20, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
        new TableCell({ children: [new Paragraph({ text: "Factos", bold: true })], width: { size: 20, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
        new TableCell({ children: [new Paragraph({ text: "Intervenientes", bold: true })], width: { size: 20, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
        new TableCell({ children: [new Paragraph({ text: "Nome do Ficheiro PDF", bold: true })], width: { size: 20, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
      ]
    }));

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
        // Create paragraphs (one per line)
        const peopleParagraphs = displayNames.map(name => new Paragraph({ text: name, spacing: { after: 60 } }));

        // Handle Facts - Display in order of creation/selection
        const factsDisplay = ext.facts && ext.facts.length > 0 ? ext.facts : ['Prova geral'];
        const factsParagraphs = factsDisplay.map(f => new Paragraph({ text: f, spacing: { after: 60 } }));

        // Reconstruct filename
        const factsSegment = sanitizeFilename(factsDisplay.join('_'));
        // a.b.c.d.e
        const filename = `${sanitizeFilename(ext.manualNumber)}.${categorySegment}.${volumeSegment}.${sanitizeFilename(ext.docType)}.${factsSegment}.pdf`;

        rows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(ext.manualNumber)] }),
            new TableCell({ children: [new Paragraph(file.volume)] }),
            new TableCell({ children: [new Paragraph(ext.docType)] }),
            new TableCell({ children: factsParagraphs }),
            new TableCell({ children: peopleParagraphs.length > 0 ? peopleParagraphs : [new Paragraph("-")] }),
            new TableCell({ children: [new Paragraph({ text: filename, style: "Code" })] }),
          ]
        }));
      });
    });

    if (rows.length === 1) {
        return [new Paragraph({ text: "Sem documentos marcados.", italic: true, spacing: { after: 200 } })];
    }

    return [new Table({
      rows: rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
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
    docChildren.push(new Paragraph({ text: "Autos Principais", heading: HeadingLevel.HEADING_1, color: HEADING_COLOR }));
    docChildren.push(...createTableForFiles(autos));
  }

  // 2. Apensos
  if (apensosMap.size > 0) {
    docChildren.push(new Paragraph({ text: "Apensos", heading: HeadingLevel.HEADING_1, color: HEADING_COLOR, spacing: { before: 200 } }));
    const sortedApensos = Array.from(apensosMap.keys()).sort();
    sortedApensos.forEach(name => {
      docChildren.push(new Paragraph({ text: name, heading: HeadingLevel.HEADING_2 }));
      docChildren.push(...createTableForFiles(apensosMap.get(name)!));
    });
  }

  // 3. Anexos
  if (anexosMap.size > 0) {
    docChildren.push(new Paragraph({ text: "Anexos", heading: HeadingLevel.HEADING_1, color: HEADING_COLOR, spacing: { before: 200 } }));
    const sortedAnexos = Array.from(anexosMap.keys()).sort();
    sortedAnexos.forEach(name => {
      docChildren.push(new Paragraph({ text: name, heading: HeadingLevel.HEADING_2 }));
      docChildren.push(...createTableForFiles(anexosMap.get(name)!));
    });
  }

  const doc = new Document({
    sections: [{
      properties: {},
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
      new TableCell({ children: [new Paragraph({ text: "N.º", bold: true })], width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
      new TableCell({ children: [new Paragraph({ text: "Tipo", bold: true })], width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
      new TableCell({ children: [new Paragraph({ text: "Localização", bold: true })], width: { size: 25, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
      new TableCell({ children: [new Paragraph({ text: "Factos", bold: true })], width: { size: 25, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
      new TableCell({ children: [new Paragraph({ text: "Intervenientes", bold: true })], width: { size: 25, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
    ]
  }));

  results.forEach(res => {
    // Location Text
    const locationText = res.category === 'Autos Principais' 
      ? `Autos - Vol. ${res.volume} (pág. ${res.startPage}-${res.endPage})`
      : `${res.categoryName} - Vol. ${res.volume} (pág. ${res.startPage}-${res.endPage})`;

    // Facts
    const factsParagraphs = res.facts.map(f => new Paragraph({ text: f, spacing: { after: 40 } }));

    // People
    const peopleParagraphs = res.people.sort().map(p => new Paragraph({ text: p, spacing: { after: 40 } }));

    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph(res.manualNumber)] }),
        new TableCell({ children: [new Paragraph(res.docType)] }),
        new TableCell({ children: [new Paragraph(locationText)] }),
        new TableCell({ children: factsParagraphs }),
        new TableCell({ children: peopleParagraphs.length > 0 ? peopleParagraphs : [new Paragraph("-")] }),
      ]
    }));
  });

  const doc = new Document({
    sections: [{
      properties: {},
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
        })
      ]
    }]
  });

  return await Packer.toBlob(doc);
};