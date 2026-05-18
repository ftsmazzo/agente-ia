import type { RagSearchCriteria } from "./rag-search-criteria.js";
import { rowMatchesCriteria } from "./rag-search-criteria.js";

const ROW_START = /Ativo,([A-Z]{2}\d{4}),/gi;

export type ParsedListing = {
  property_code: string;
  raw: string;
  /** Preenchido quando o chunk é `Referência: AP#### | Bairro: ...` */
  fields?: SpreadsheetListingFields;
};

import {
  parseSpreadsheetRowChunks,
  type SpreadsheetListingFields,
} from "./rag-spreadsheet-row.js";

export type { SpreadsheetListingFields };

/** Extrai imóveis de chunks RAG (formato planilha por linha ou CSV legado). */
export function parseListingsFromChunk(content: string): ParsedListing[] {
  const spreadsheet = parseSpreadsheetRowChunks(content);
  if (spreadsheet.length > 0) return spreadsheet;

  const listings: ParsedListing[] = [];
  const indices: Array<{ code: string; start: number }> = [];

  for (const match of content.matchAll(ROW_START)) {
    if (match.index === undefined || !match[1]) continue;
    indices.push({ code: match[1].toUpperCase(), start: match.index });
  }

  for (let i = 0; i < indices.length; i++) {
    const { code, start } = indices[i];
    const end = indices[i + 1]?.start ?? content.length;
    listings.push({
      property_code: code,
      raw: content.slice(start, end),
    });
  }

  return listings;
}

export function filterListingsByCriteria(
  listings: ParsedListing[],
  criteria: RagSearchCriteria,
  limit = 8,
): ParsedListing[] {
  const hasCriteria =
    criteria.neighborhoods.length > 0 ||
    criteria.bedrooms !== null ||
    criteria.bathrooms !== null ||
    criteria.propertyTypes.length > 0;

  if (!hasCriteria) {
    return listings.slice(0, limit);
  }

  const matched = listings.filter((l) => rowMatchesCriteria(l.raw, criteria));

  const seen = new Set<string>();
  const unique: ParsedListing[] = [];
  for (const item of matched) {
    if (seen.has(item.property_code)) continue;
    seen.add(item.property_code);
    unique.push(item);
  }

  return unique.slice(0, limit);
}
