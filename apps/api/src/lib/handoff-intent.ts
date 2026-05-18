/** Pedido explícito de atendimento humano (WhatsApp). */
const HANDOFF_PATTERNS = [
  /\b(?:falar|falo|quero falar)\s+com\s+(?:um\s+)?(?:corretor|atendente|pessoa|humano)\b/i,
  /\b(?:atendimento|atendente)\s+humano\b/i,
  /\bpessoa\s+real\b/i,
  /\bcorretor\s+(?:humano|de verdade)\b/i,
  /\b(?:me\s+)?passa(?:r|me)?\s+(?:para|pro?)\s+(?:um\s+)?(?:corretor|atendente|humano)\b/i,
  /\bquero\s+um\s+humano\b/i,
];

/** Cliente pede para voltar ao bot / SofIA. */
const RETURN_TO_BOT_PATTERNS = [
  /\bvoltar\s+(?:ao|para o?)\s+bot\b/i,
  /\bpode\s+ser\s+(?:a\s+)?(?:sofia|sofIA|assistente)\b/i,
  /\batendimento\s+autom[aá]tico\b/i,
  /\bvolta(?:r)?\s+(?:com\s+)?a\s+sofia\b/i,
];

export function wantsHumanHandoff(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  return HANDOFF_PATTERNS.some((re) => re.test(t));
}

export function wantsReturnToBot(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  return RETURN_TO_BOT_PATTERNS.some((re) => re.test(t));
}

export function buildHandoffReply(
  brandName: string,
  assistantName: string,
  contactName: string | null,
): string {
  const who = contactName ? `${contactName}, ` : "";
  return `${who}com certeza! Vou acionar um corretor da ${brandName} para continuar com você por aqui. Em instantes alguém da equipe assume — obrigada por falar com a ${assistantName}.`;
}

export function buildReturnToBotReply(
  assistantName: string,
  contactName: string | null,
): string {
  const who = contactName ? `${contactName}, ` : "";
  return `${who}perfeito! Sou a ${assistantName} de novo e sigo com você por aqui. Como posso ajudar?`;
}
