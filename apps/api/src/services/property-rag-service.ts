import type { BrandConfig } from "@realty/shared";
import type { RagSettings } from "../config/rag-config.js";
import type { MessageIntent } from "../lib/message-intent.js";
import {
  filterListingsByCriteria,
  parseListingsFromChunk,
  type ParsedListing,
} from "../lib/rag-csv-listings.js";
import {
  extractBairroFromSpreadsheetText,
  extractCodeFromSpreadsheetText,
  formatSpreadsheetListingCard,
  parseSpreadsheetListing,
} from "../lib/rag-spreadsheet-row.js";
import {
  criteriaFromHistory,
  type RagSearchCriteria,
} from "../lib/rag-search-criteria.js";
import type { ChatTurn } from "./conversation-history.js";
import { formatPropertyKnowledgeBlock } from "./agent-service.js";
import { queryKnowledgeBase } from "./rag-client.js";

const PROPERTY_CODE = /\b([A-Za-z]{2}\d{4})\b/i;

function sanitizeSnippet(text: string): string {
  return text
    .replace(/\b\d{2}\s?\d{4,5}-?\d{4}\b/g, "[telefone omitido]")
    .replace(
      /\b(?:rua|av\.|avenida|alameda|travessa|rodovia)\s+[^.\n]{10,80}/gi,
      "[endereço completo omitido — informar bairro na visita]",
    )
    .replace(
      /\b(?:aluguel|locação|alugar|inquilino|fiador|caução)\b/gi,
      "[locação omitida]",
    )
    .trim();
}

export function shouldQueryPropertyRag(
  rag: RagSettings,
  intent: MessageIntent,
): boolean {
  if (!rag.enabled) return false;
  return intent === "property_by_code" || intent === "property_by_criteria";
}

export function buildRagQuery(params: {
  userMessage: string;
  intent: MessageIntent;
  propertyCode: string | null;
  brandName: string;
  criteria: RagSearchCriteria;
}): string {
  const parts: string[] = [];

  if (params.intent === "property_by_code" && params.propertyCode) {
    parts.push(
      `Referência: ${params.propertyCode}`,
      `imóvel à venda código ${params.propertyCode}`,
      params.brandName,
    );
    return parts.join(" ");
  }

  const msg = params.userMessage.trim();
  parts.push(msg);

  // Só acrescenta bairro se não estiver já na mensagem (evita query poluída)
  for (const bairro of params.criteria.neighborhoods) {
    if (!msg.toLowerCase().includes(bairro.toLowerCase())) {
      parts.push(`bairro ${bairro}`);
    }
  }
  if (params.criteria.bedrooms !== null) {
    parts.push(`${params.criteria.bedrooms} quartos`);
  }
  if (params.criteria.bathrooms !== null) {
    parts.push(`${params.criteria.bathrooms} banheiro`);
  }
  if (params.criteria.propertyTypes.length > 0) {
    parts.push(params.criteria.propertyTypes.join(" "));
  }

  parts.push("Ribeirão Preto", "venda", "não aluguel", params.brandName);
  return parts.join(" ");
}

function effectiveTopK(rag: RagSettings, intent: MessageIntent): number {
  if (intent === "property_by_code") return rag.topK;
  const criteriaMin = Number(process.env.RAG_TOP_K_CRITERIA ?? 10);
  const minK = Number.isFinite(criteriaMin) && criteriaMin > 0 ? criteriaMin : 10;
  return Math.max(rag.topK, minK);
}

function extractPropertyCode(...texts: Array<string | undefined>): string | null {
  for (const text of texts) {
    if (!text) continue;
    const fromSheet = extractCodeFromSpreadsheetText(text);
    if (fromSheet) return fromSheet;
    const match = text.match(PROPERTY_CODE);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

function inferBairroFromRow(raw: string): string | null {
  return (
    extractBairroFromSpreadsheetText(raw) ??
    raw.match(/"[^"]*",(?:[^,]*,)?([^,]+),[^,]*,Ribeirão Preto/i)?.[1]?.trim() ??
    null
  );
}

function inferTipoFromRow(raw: string): string | null {
  const match = raw.match(/Ativo,[A-Z]{2}\d{4},(?:[^,]+,)?([^,]+),Residencial/i);
  return match?.[1]?.trim() ?? null;
}

const MAX_LISTINGS_FOR_LLM = 3;

function listingToRecord(
  listing: ParsedListing,
  brand: BrandConfig,
): Record<string, unknown> {
  const website = brand.brandWebsite?.replace(/\/$/, "") ?? "";
  const link = website
    ? `${website}/imovel/${listing.property_code}`
    : undefined;

  const fields =
    listing.fields ?? parseSpreadsheetListing(listing.raw) ?? undefined;

  if (fields) {
    return {
      property_code: fields.property_code,
      card: formatSpreadsheetListingCard(fields, link),
      fields,
      ...(link ? { link } : {}),
    };
  }

  const bairro = inferBairroFromRow(listing.raw);
  const tipo = inferTipoFromRow(listing.raw);
  const summaryParts = [
    tipo ? `Tipo: ${tipo}` : null,
    bairro ? `Bairro: ${bairro}` : null,
    sanitizeSnippet(listing.raw).slice(0, 400),
  ].filter(Boolean);

  return {
    property_code: listing.property_code,
    card: summaryParts.join(" | "),
    ...(link ? { link } : {}),
  };
}

function sourcesToRecords(
  sources: Awaited<ReturnType<typeof queryKnowledgeBase>>["sources"],
  brand: BrandConfig,
  criteria: RagSearchCriteria,
): Array<Record<string, unknown>> {
  const allListings: ParsedListing[] = [];
  for (const source of sources) {
    allListings.push(...parseListingsFromChunk(source.content));
  }

  const filtered = filterListingsByCriteria(allListings, criteria, 8);

  if (filtered.length > 0) {
    return filtered
      .slice(0, MAX_LISTINGS_FOR_LLM)
      .map((l) => listingToRecord(l, brand));
  }

  const website = brand.brandWebsite?.replace(/\/$/, "") ?? "";
  return sources.map((source) => {
    const code =
      extractPropertyCode(source.content, source.filename) ?? "?";
    return {
      property_code: code,
      titulo: source.filename ?? code,
      summary: sanitizeSnippet(source.content).slice(0, 900),
      similarity: source.similarity,
      ...(website && code !== "?"
        ? { link: `${website}/imovel/${code}` }
        : {}),
    };
  });
}

function buildKnowledgeBlock(
  records: Array<Record<string, unknown>>,
  criteria: RagSearchCriteria,
  parsedFromCsv: boolean,
  ragAnswer: string | null,
): string {
  const innerParts: string[] = [];
  const answerText = ragAnswer?.trim() ?? "";

  // Com fichas parseadas dos chunks, não duplicar o texto cru do RAG (evita lista robótica)
  if (answerText && records.length === 0) {
    innerParts.push(sanitizeSnippet(answerText).slice(0, 2000));
  }

  if (records.length > 0) {
    const recordsBlock = formatPropertyKnowledgeBlock(records);
    const inner = recordsBlock
      .replace(/^\[DADOS DO SISTEMA\]\n?/, "")
      .replace(/\n?\[\/DADOS DO SISTEMA\]$/, "")
      .trim();
    if (inner) innerParts.push(inner);
  }

  if (innerParts.length > 0) {
    const header =
      parsedFromCsv && criteria.neighborhoods.length > 0
        ? `[Critérios: ${criteria.neighborhoods.join(", ")}${criteria.bedrooms ? `; ${criteria.bedrooms} quartos` : ""}]\n`
        : "";
    return `${header}[DADOS DO SISTEMA]\n${innerParts.join("\n\n")}\n[/DADOS DO SISTEMA]`;
  }

  if (criteria.neighborhoods.length > 0) {
    const bairros = criteria.neighborhoods.join(", ");
    const extra = criteria.bedrooms
      ? `, ${criteria.bedrooms} quartos`
      : "";
    return `[DADOS DO SISTEMA]
Nenhum imóvel encontrado na base para: ${bairros}${extra}.
Qualifique o cliente sem inventar anúncios.
[/DADOS DO SISTEMA]`;
  }

  return "";
}

export async function fetchPropertyKnowledgeFromRag(params: {
  rag: RagSettings;
  brand: BrandConfig;
  userMessage: string;
  intent: MessageIntent;
  propertyCode: string | null;
  history?: ChatTurn[];
}): Promise<
  | {
      block: string;
      sourceCount: number;
      ragQuery: string;
      parsedListings: number;
      matchedListings: number;
      hadRagAnswer: boolean;
    }
  | undefined
> {
  if (!shouldQueryPropertyRag(params.rag, params.intent)) {
    return undefined;
  }

  const criteria = criteriaFromHistory(
    params.userMessage,
    params.history ?? [],
  );

  const ragQuery = buildRagQuery({
    userMessage: params.userMessage,
    intent: params.intent,
    propertyCode: params.propertyCode,
    brandName: params.brand.brandName,
    criteria,
  });

  const topK = effectiveTopK(params.rag, params.intent);

  const result = await queryKnowledgeBase({
    baseUrl: params.rag.baseUrl,
    apiKey: params.rag.apiKey,
    knowledgeBaseId: params.rag.knowledgeBaseId,
    query: ragQuery,
    topK,
    timeoutMs: params.rag.timeoutMs,
  });

  const allListings = result.sources.flatMap((s) =>
    parseListingsFromChunk(s.content),
  );
  const matched = filterListingsByCriteria(allListings, criteria, 8);
  const parsedFromCsv = matched.length > 0;

  let records = sourcesToRecords(result.sources, params.brand, criteria);

  if (
    params.intent === "property_by_code" &&
    params.propertyCode &&
    allListings.length > 0
  ) {
    const code = params.propertyCode.toUpperCase();
    const exact = allListings.find((l) => l.property_code === code);
    if (exact) {
      records = [listingToRecord(exact, params.brand)];
    }
  }

  if (records.length === 0 && result.answer && !result.sources.length) {
    records = [
      {
        property_code:
          extractPropertyCode(result.answer, params.propertyCode ?? undefined) ??
          "?",
        summary: sanitizeSnippet(result.answer).slice(0, 900),
      },
    ];
  }

  return {
    block: buildKnowledgeBlock(
      records,
      criteria,
      parsedFromCsv,
      result.answer,
    ),
    sourceCount: records.length,
    ragQuery,
    parsedListings: allListings.length,
    matchedListings: matched.length,
    hadRagAnswer: Boolean(result.answer),
  };
}
