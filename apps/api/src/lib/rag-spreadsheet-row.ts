import type { ParsedListing } from "./rag-csv-listings.js";

const REF_PATTERN = /Referência:\s*(AP\d{4})\b/i;

/** Chunks do RAG: Planilha | Linha | Referência: AP#### | Bairro: ... */
export function parseSpreadsheetRowChunks(content: string): ParsedListing[] {
  const ref = content.match(REF_PATTERN);
  if (!ref?.[1]) return [];

  return [
    {
      property_code: ref[1].toUpperCase(),
      raw: content,
    },
  ];
}

export function extractCodeFromSpreadsheetText(
  text: string,
): string | null {
  const match = text.match(REF_PATTERN);
  return match?.[1]?.toUpperCase() ?? null;
}

export function extractBairroFromSpreadsheetText(text: string): string | null {
  const match = text.match(/Bairro:\s*([^|]+?)(?:\s*\||$)/i);
  return match?.[1]?.trim() ?? null;
}
