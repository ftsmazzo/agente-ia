import type { RagSearchCriteria } from "./rag-search-criteria.js";
import { rowMatchesCriteria } from "./rag-search-criteria.js";

const ROW_START = /Ativo,([A-Z]{2}\d{4}),/gi;

export type ParsedListing = {
  property_code: string;
  raw: string;
};

/** Extrai linhas "Ativo,AP####,..." de chunks CSV indexados no RAG. */
export function parseListingsFromChunk(content: string): ParsedListing[] {
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
  return matched.slice(0, limit);
}
