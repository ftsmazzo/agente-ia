/**
 * Resolve contact display name from WhatsApp metadata (Evolution pushName) or message text.
 */
export function resolveDisplayName(
  metadata: Record<string, unknown> | undefined,
  messageText: string,
): string | null {
  const candidates = [
    metadata?.displayName,
    metadata?.pushName,
    metadata?.whatsappName,
    metadata?.notifyName,
  ];

  for (const value of candidates) {
    if (typeof value === "string") {
      const trimmed = value.trim().replace(/\s+/g, " ");
      if (trimmed.length >= 2 && trimmed.length <= 120) {
        return trimmed;
      }
    }
  }

  // Nome explícito na mensagem ("me chamo João") — fase leve sem LLM
  const intro = messageText.match(
    /\b(?:me\s+chamo|meu\s+nome\s+[eé]|sou\s+(?:o|a)\s+)([A-Za-zÀ-ú][A-Za-zÀ-ú\s'.-]{1,60})/i,
  );
  if (intro?.[1]) {
    const name = intro[1].trim();
    if (name.length >= 2) return name;
  }

  return null;
}
