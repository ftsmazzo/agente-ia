const PROPERTY_CODE = /\b([A-Za-z]{2}[0-9]{4})\b/i;

const INTEREST_PATTERN =
  /im[oó]vel|imovel|apartamento|casa|terreno|valores|pre[cç]o|informa[cç][oõ]es|visitar|visita|agendar|interessado|interesse/i;

export type ExtractedMessage = {
  propertyCode: string | null;
  hasPropertyInterest: boolean;
};

export function extractFromMessage(text: string): ExtractedMessage {
  const match = text.match(PROPERTY_CODE);
  const propertyCode = match?.[1]?.toUpperCase() ?? null;
  const hasPropertyInterest = INTEREST_PATTERN.test(text) || !!propertyCode;
  return { propertyCode, hasPropertyInterest };
}
