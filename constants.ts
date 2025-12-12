export const DEFAULT_DOC_TYPES = [
  "Acusação",
  "Apreensões",
  "Audio",
  "Auto de diligência externa",
  "Buscas/Revistas",
  "Certidão permanente",
  "Certidão comercial",
  "Certidão judicial",
  "Certidão predial",
  "Contestação",
  "Constituição como Arguido",
  "Constituição como Assistente",
  "CRC",
  "Declarações para memória futura",
  "Denúncias",
  "Depoimento por magistrado",
  "Depoimento por OPC",
  "Despacho de Pronúncia",
  "Despacho juiz",
  "Despacho MP",
  "Despacho OPC",
  "Documento",
  "Exames/Perícias",
  "Exames a Telemóveis",
  "Ficha de Identificação Civil",
  "Ficha de Registo Automóvel",
  "Imagens",
  "Informação Fiscal",
  "Informação Segurança Social",
  "Procurações",
  "Reconhecimento de objetos",
  "Reconhecimento de pessoas",
  "TIR",
  "Transcrições",
  "Vigilâncias"
].sort();

export const DEFAULT_FACTS = [
  "Prova geral"
];

// Helper to sanitize filenames
export const sanitizeFilename = (name: string) => {
  return name.replace(/[^a-z0-9à-ú\s\-_.]/gi, '_').trim();
};