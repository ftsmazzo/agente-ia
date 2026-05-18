import type { ChatTurn } from "../services/conversation-history.js";

export type RagSearchCriteria = {
  neighborhoods: string[];
  bedrooms: number | null;
  bathrooms: number | null;
  propertyTypes: string[];
};

const NEIGHBORHOOD_PATTERN =
  /(?:no|na|em|bairro)\s+([A-Za-zÀ-ú][A-Za-zÀ-ú\s]{2,38}?)(?:\?|,|\.|!|$)/gi;

const BEDROOM_PATTERN = /\b(\d+)\s*(?:quartos?|dorm(?:itórios)?|su[ií]tes?)\b/i;
const BATHROOM_PATTERN = /\b(\d+)\s*banheiros?\b/i;

/** Mensagens curtas que só refinam bairro na conversa */
const FOLLOW_UP_NEIGHBORHOOD =
  /^(?:e\s+)?(?:no|na|em)\s+(.+?)\??$/i;

function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanNeighborhood(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length < 3 || trimmed.length > 40) return null;
  const lower = trimmed.toLowerCase();
  if (
    /^(sim|não|nao|ok|oi|olá|ola|compra|alugar|venda|apartamento|casa|terreno)$/.test(
      lower,
    )
  ) {
    return null;
  }
  return trimmed;
}

export function extractNeighborhoods(text: string): string[] {
  const found = new Set<string>();

  const followUp = text.trim().match(FOLLOW_UP_NEIGHBORHOOD);
  if (followUp?.[1]) {
    const n = cleanNeighborhood(followUp[1]);
    if (n) found.add(n);
  }

  for (const match of text.matchAll(NEIGHBORHOOD_PATTERN)) {
    const n = cleanNeighborhood(match[1] ?? "");
    if (n) found.add(n);
  }

  return [...found];
}

export function extractRagSearchCriteria(
  userMessage: string,
  recentUserMessages: string[],
): RagSearchCriteria {
  const combined = [userMessage, ...recentUserMessages].join("\n");
  const neighborhoods = extractNeighborhoods(combined);

  const bedMatch = combined.match(BEDROOM_PATTERN);
  const bathMatch = combined.match(BATHROOM_PATTERN);

  const propertyTypes: string[] = [];
  if (/apartamento/i.test(combined)) propertyTypes.push("apartamento");
  if (/\bcasa\b/i.test(combined)) propertyTypes.push("casa");
  if (/sobrado/i.test(combined)) propertyTypes.push("sobrado");

  return {
    neighborhoods,
    bedrooms: bedMatch ? Number(bedMatch[1]) : null,
    bathrooms: bathMatch ? Number(bathMatch[1]) : null,
    propertyTypes,
  };
}

export function criteriaFromHistory(
  userMessage: string,
  history: ChatTurn[],
): RagSearchCriteria {
  const recentUser = history
    .filter((t) => t.role === "user")
    .slice(-4)
    .map((t) => t.content);

  const current = extractRagSearchCriteria(userMessage, []);
  const withHistory = extractRagSearchCriteria(userMessage, recentUser);

  // Bairro: prioriza a mensagem atual (evita misturar Centro + Planalto na query RAG)
  const neighborhoods =
    current.neighborhoods.length > 0
      ? current.neighborhoods
      : withHistory.neighborhoods;

  return {
    neighborhoods,
    // Quartos/banheiros só da mensagem atual (evita SofIA confirmar perfil antigo)
    bedrooms: current.bedrooms,
    bathrooms: current.bathrooms,
    propertyTypes:
      current.propertyTypes.length > 0
        ? current.propertyTypes
        : withHistory.propertyTypes,
  };
}

/** Texto curto só com o que o cliente disse na mensagem atual (confirmação no WhatsApp). */
export function formatQualificationHint(
  criteria: RagSearchCriteria,
): string | null {
  const parts: string[] = [];
  if (criteria.neighborhoods.length > 0) {
    parts.push(`bairro ${criteria.neighborhoods.join(" ou ")}`);
  }
  if (criteria.propertyTypes.length > 0) {
    parts.push(criteria.propertyTypes.join(", "));
  }
  if (criteria.bedrooms !== null) {
    parts.push(`${criteria.bedrooms} quarto(s)`);
  }
  if (criteria.bathrooms !== null) {
    parts.push(`${criteria.bathrooms} banheiro(s)`);
  }
  return parts.length > 0 ? parts.join("; ") : null;
}

export function textMatchesNeighborhood(
  haystack: string,
  neighborhood: string,
): boolean {
  const h = normalizeForMatch(haystack);
  const n = normalizeForMatch(neighborhood);
  if (!n) return false;

  const bairroField = h.match(/bairro:\s*([^|]+)/i)?.[1]?.trim();
  if (bairroField && normalizeForMatch(bairroField).includes(n)) {
    return true;
  }

  if (h.includes(n)) return true;

  // "Centro" em CSV legado: vírgula ao redor
  if (n === "centro") {
    return /,centro,|,centro | centro,| centro /.test(h);
  }

  return false;
}

export function rowMatchesCriteria(
  rowText: string,
  criteria: RagSearchCriteria,
): boolean {
  if (criteria.neighborhoods.length > 0) {
    const hit = criteria.neighborhoods.some((n) =>
      textMatchesNeighborhood(rowText, n),
    );
    if (!hit) return false;
  }

  if (criteria.bedrooms !== null) {
    const q = criteria.bedrooms;
    const hasBedrooms =
      rowText.includes(`,${q},`) ||
      new RegExp(`,${q},\\d+,\\d+,`).test(rowText);
    if (!hasBedrooms) return false;
  }

  if (criteria.bathrooms !== null) {
    const b = criteria.bathrooms;
    if (!rowText.includes(`,${b},`) && !rowText.includes(`,${b},0,`)) {
      return false;
    }
  }

  if (criteria.propertyTypes.length > 0) {
    const typeHit = criteria.propertyTypes.some((t) =>
      rowText.toLowerCase().includes(t),
    );
    if (!typeHit) return false;
  }

  return true;
}
