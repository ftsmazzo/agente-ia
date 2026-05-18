import type pg from "pg";
import type { BrandConfig } from "@realty/shared";
import type { RagSettings } from "../config/rag-config.js";
import type { MessageIntent } from "../lib/message-intent.js";
import { criteriaFromHistory } from "../lib/rag-search-criteria.js";
import type { ChatTurn } from "./conversation-history.js";
import {
  buildKnowledgeBlockFromCatalog,
  countActiveCatalogItems,
  getCatalogItemByCode,
  searchCatalogByCriteria,
} from "./generic-catalog-service.js";
import {
  fetchPropertyKnowledgeFromRag,
  shouldQueryPropertyRag,
} from "./property-rag-service.js";

export type PropertyKnowledgeResult = {
  block: string;
  source: "catalog" | "rag" | "catalog+rag";
  sourceCount: number;
  ragQuery?: string;
  parsedListings?: number;
  matchedListings?: number;
  hadRagAnswer?: boolean;
};

/**
 * Catálogo genérico (CSV) primeiro; RAG só se vazio ou sem match.
 */
export async function fetchPropertyKnowledge(params: {
  pool: pg.Pool;
  rag: RagSettings;
  brand: BrandConfig;
  userMessage: string;
  intent: MessageIntent;
  propertyCode: string | null;
  history?: ChatTurn[];
}): Promise<PropertyKnowledgeResult | undefined> {
  if (!shouldQueryPropertyRag(params.rag, params.intent)) {
    return undefined;
  }

  const catalogCount = await countActiveCatalogItems(params.pool);
  if (catalogCount === 0) {
    const ragOnly = await fetchPropertyKnowledgeFromRag(params);
    if (!ragOnly?.block) return undefined;
    return {
      block: ragOnly.block,
      source: "rag",
      sourceCount: ragOnly.sourceCount,
      ragQuery: ragOnly.ragQuery,
      parsedListings: ragOnly.parsedListings,
      matchedListings: ragOnly.matchedListings,
      hadRagAnswer: ragOnly.hadRagAnswer,
    };
  }

  const criteria = criteriaFromHistory(
    params.userMessage,
    params.history ?? [],
  );

  if (params.intent === "property_by_code" && params.propertyCode) {
    const found = await getCatalogItemByCode(
      params.pool,
      params.propertyCode,
    );
    if (found) {
      return {
        block: buildKnowledgeBlockFromCatalog([found], criteria),
        source: "catalog",
        sourceCount: 1,
        matchedListings: 1,
        parsedListings: 1,
      };
    }

    const ragFallback = await fetchPropertyKnowledgeFromRag(params);
    if (ragFallback?.block) {
      return {
        block: ragFallback.block,
        source: "rag",
        sourceCount: ragFallback.sourceCount,
        ragQuery: ragFallback.ragQuery,
        parsedListings: ragFallback.parsedListings,
        matchedListings: ragFallback.matchedListings,
        hadRagAnswer: ragFallback.hadRagAnswer,
      };
    }

    return {
      block: `[DADOS DO SISTEMA]
Não encontrei o item ${params.propertyCode} no catálogo atual.
[/DADOS DO SISTEMA]`,
      source: "catalog",
      sourceCount: 0,
    };
  }

  if (params.intent === "property_by_criteria") {
    const matches = await searchCatalogByCriteria(
      params.pool,
      criteria,
      8,
    );
    if (matches.length > 0) {
      return {
        block: buildKnowledgeBlockFromCatalog(matches, criteria),
        source: "catalog",
        sourceCount: matches.length,
        matchedListings: matches.length,
        parsedListings: matches.length,
      };
    }

    const ragFallback = await fetchPropertyKnowledgeFromRag(params);
    if (ragFallback?.block) {
      return {
        block: ragFallback.block,
        source: "rag",
        sourceCount: ragFallback.sourceCount,
        ragQuery: ragFallback.ragQuery,
        parsedListings: ragFallback.parsedListings,
        matchedListings: ragFallback.matchedListings,
        hadRagAnswer: ragFallback.hadRagAnswer,
      };
    }
  }

  const ragResult = await fetchPropertyKnowledgeFromRag(params);
  if (!ragResult?.block) return undefined;
  return {
    block: ragResult.block,
    source: "rag",
    sourceCount: ragResult.sourceCount,
    ragQuery: ragResult.ragQuery,
    parsedListings: ragResult.parsedListings,
    matchedListings: ragResult.matchedListings,
    hadRagAnswer: ragResult.hadRagAnswer,
  };
}
