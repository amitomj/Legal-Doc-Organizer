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
  docType: string;
  people: string[]; // List of person names associated
  facts: string[]; // List of facts associated
}

export interface CaseFile {
  id: string;
  file: File | null;
  fileName?: string;
  relativePath?: string; // Path relative to the root folder
  category: DocCategory;
  categoryName?: string; // Used for name of Apenso/Anexo
  volume: string;
  extractions: Extraction[];
  pageCount?: number;
}

export interface ExtractionMeta {
  manualNumber: string;
  docType: string;
  selectedPeople: string[];
  selectedFacts: string[];
}