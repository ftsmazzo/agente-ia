import type { ChatTurn } from "../services/conversation-history.js";

const AP_CODE = /\b(AP\d{4})\b/gi;

/** Códigos AP#### mencionados pela assistente na conversa (ordem de aparição). */
export function extractPropertyCodesFromHistory(history: ChatTurn[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const turn of history) {
    if (turn.role !== "assistant") continue;
    for (const match of turn.content.matchAll(AP_CODE)) {
      const code = match[1].toUpperCase();
      if (!seen.has(code)) {
        seen.add(code);
        ordered.push(code);
      }
    }
  }
  return ordered;
}

export function formatPropertyInterestLine(
  primaryCode: string | null | undefined,
  presentedCodes: string[],
): string | null {
  const primary = primaryCode?.trim().toUpperCase() || null;
  if (primary) return `Imóvel: ${primary}`;
  if (presentedCodes.length === 1) return `Imóvel: ${presentedCodes[0]}`;
  if (presentedCodes.length > 1) {
    return `Opções apresentadas: ${presentedCodes.join(", ")}`;
  }
  return null;
}
