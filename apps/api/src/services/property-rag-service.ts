import type { BrandConfig } from "@realty/shared";
import type { RagSettings } from "../config/rag-config.js";
import type { MessageIntent } from "../lib/message-intent.js";
import { formatPropertyKnowledgeBlock } from "./agent-service.js";
import { queryKnowledgeBase } from "./rag-client.js";

const PROPERTY_CODE = /\b([A-Za-z]{2}\d{4})\b/i;

/** Remove trechos sensíveis antes de enviar ao LLM (camada extra à persona). */
function sanitizeSnippet(text: string): string {
  return text
    .replace(/\b\d{2}\s?\d{4,5}-?\d{4}\b/g, "[telefone omitido]")
    .replace(
      /\b(?:rua|av\.|avenida|alameda|travessa|rodovia)\s+[^.\n]{10,80}/gi,
      "[endereço completo omitido — informar bairro na visita]",
    )
    .replace(/\b(?:aluguel|locação|alugar|inquilino|fiador|caução)\b/gi, "[locação omitida]")
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
}): string {
  const saleContext = "imóvel à venda compra (não aluguel)";

  if (params.intent === "property_by_code" && params.propertyCode) {
    return `${saleContext} código ${params.propertyCode} ficha detalhes ${params.brandName}`;
  }

  return `${params.userMessage.trim()} ${saleContext}`;
}

function extractPropertyCode(...texts: Array<string | undefined>): string | null {
  for (const text of texts) {
    if (!text) continue;
    const match = text.match(PROPERTY_CODE);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

function sourcesToRecords(
  sources: Awaited<ReturnType<typeof queryKnowledgeBase>>["sources"],
  brand: BrandConfig,
): Array<Record<string, unknown>> {
  const website = brand.brandWebsite?.replace(/\/$/, "") ?? "";

  return sources.map((source) => {
    const code =
      extractPropertyCode(source.content, source.filename) ?? "?";
    const summary = sanitizeSnippet(source.content).slice(0, 900);
    const link =
      website && code !== "?"
        ? `${website}/imovel/${code}`
        : undefined;

    return {
      property_code: code,
      titulo: source.filename ?? code,
      summary,
      similarity: source.similarity,
      ...(link ? { link } : {}),
    };
  });
}

/**
 * Consulta o RAG e devolve bloco [DADOS DO SISTEMA] ou undefined se desligado/erro.
 */
export async function fetchPropertyKnowledgeFromRag(params: {
  rag: RagSettings;
  brand: BrandConfig;
  userMessage: string;
  intent: MessageIntent;
  propertyCode: string | null;
}): Promise<
  | { block: string; sourceCount: number; ragQuery: string }
  | undefined
> {
  if (!shouldQueryPropertyRag(params.rag, params.intent)) {
    return undefined;
  }

  const ragQuery = buildRagQuery({
    userMessage: params.userMessage,
    intent: params.intent,
    propertyCode: params.propertyCode,
    brandName: params.brand.brandName,
  });

  const result = await queryKnowledgeBase({
    baseUrl: params.rag.baseUrl,
    apiKey: params.rag.apiKey,
    knowledgeBaseId: params.rag.knowledgeBaseId,
    query: ragQuery,
    topK: params.rag.topK,
    timeoutMs: params.rag.timeoutMs,
  });

  let records = sourcesToRecords(result.sources, params.brand);

  if (records.length === 0 && result.answer) {
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
    block: formatPropertyKnowledgeBlock(records),
    sourceCount: records.length,
    ragQuery,
  };
}
