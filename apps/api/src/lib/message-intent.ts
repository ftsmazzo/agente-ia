import type { ExtractedMessage } from "./extract-message.js";

/** Como o cliente chegou — define qual ferramenta de imóvel usar (fase RAG) */
export type MessageIntent =
  | "property_by_code"
  | "property_by_criteria"
  | "general";

const CRITERIA_PATTERN =
  /\b(\d+)\s*(?:quartos?|dorm|su[ií]tes?)\b|bairro|regi[aã]o|centro|alugar|aluguel|comprar|venda|at[eé]\s*R\$|m2|m²|metragem|condom[ií]nio/i;

export function classifyMessageIntent(
  text: string,
  extracted: ExtractedMessage,
): MessageIntent {
  if (extracted.propertyCode) return "property_by_code";
  if (extracted.hasPropertyInterest || CRITERIA_PATTERN.test(text)) {
    return "property_by_criteria";
  }
  return "general";
}
