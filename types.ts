
export type DocCategory = 'Autos Principais' | 'Apenso' | 'Anexo';

export type PersonType = 'Arguido' | 'Testemunha' | 'Perito';

export interface Person {
  id: string;
  name: string;
  type: PersonType;
}

export interface Extraction {
  id: string;
  startPage: number;
  endPage: number;
  manualNumber: string;
  articles: string;
  docType: string;
  summary: string; // New field
  people: string[];
  facts: string[];
}

export interface CaseFile {
  id: string;
  file: File | null;
  fileName?: string;
  relativePath?: string;
  category: DocCategory;
  categoryName?: string;
  volume: string;
  extractions: Extraction[];
  pageCount?: number;
}

export interface ExtractionMeta {
  manualNumber: string;
  articles: string;
  docType: string;
  summary: string; // New field
  selectedPeople: string[];
  selectedFacts: string[];
}

export interface SearchResult {
  fileId: string;
  extractionId: string;
  volume: string;
  category: string;
  categoryName?: string;
  manualNumber: string;
  articles: string;
  docType: string;
  summary: string; // New field
  people: string[];
  facts: string[];
  startPage: number;
  endPage: number;
}

export type OnConfirmExtraction = (data: ExtractionMeta, newPageRange?: { start: number; end: number }) => void;
