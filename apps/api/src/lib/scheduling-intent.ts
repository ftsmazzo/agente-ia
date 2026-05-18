/** Respostas curtas de aceite após convite de visita (ex.: "gostaria sim", "sim", "pode ser"). */
const VISIT_ACCEPT =
  /^(?:sim|ok|pode(?:\s+ser)?|gostaria(?:\s+sim)?|quero(?:\s+sim)?|vamos|aceito|combinado|fechado|claro|perfeito|isso)(?:[!.?]*)?$/i;

/** Convite de visita na última resposta do bot. */
const VISIT_INVITE_IN_REPLY =
  /\b(agendar|agende|marcar)\b.*\bvisita\b|\bvisita\b.*\b(imobili[aá]ria|pazotti|sede)\b|\bcomo est[aá] sua agenda\b|\bconhecer\b.*\bpessoalmente\b/i;

/** Cliente encerra ou adia a conversa (obrigado, até amanhã, etc.). */
const QUAL_DISMISS =
  /\b(obrigad[oa]|valeu|agrade[cç]o|at[eé]\s*(logo|mais|breve)?|tchau|deixa\s+(pra|para)|amanh[aã]|depois|por\s+enquanto|s[oó]\s+isso|j[aá]\s+est[aá]\s+bom)\b/i;

/** Cliente aceita responder algo antes (sem abrir interrogatório financeiro). */
const QUAL_BEFORE_MEETING =
  /\b(antes|agora|aqui|pelo\s+whatsapp|adiantar|por\s+aqui)\b/i;

export type QualificationChoice = "at_meeting" | "before" | "dismiss";

export function acceptsVisitAffirmative(message: string): boolean {
  const t = message.trim();
  if (!t || t.length > 48) return false;
  return VISIT_ACCEPT.test(t);
}

export function botMessageInvitesVisit(replyText: string): boolean {
  return VISIT_INVITE_IN_REPLY.test(replyText);
}

/** Interpreta resposta após visita confirmada (na visita, antes, ou encerramento). */
export function resolveQualificationChoice(
  message: string,
): QualificationChoice | null {
  const t = message.trim().toLowerCase();
  if (!t || t.length > 200) return null;

  if (QUAL_BEFORE_MEETING.test(t) && !/\bpessoalmente\b/i.test(t)) {
    return "before";
  }

  if (/\bpessoalmente\b/i.test(t)) return "at_meeting";
  if (/\bconversamos\b/i.test(t) && !/\bantes\b/i.test(t)) return "at_meeting";
  if (/\b(na\s+)?visita\b/i.test(t) && !/\bantes\b/i.test(t)) {
    return "at_meeting";
  }
  if (/\b(reuni[aã]o|encontro|presencial|no\s+dia)\b/i.test(t)) {
    return "at_meeting";
  }
  if (
    /\bmelhor\b/i.test(t) &&
    (/\bpessoalmente\b/i.test(t) ||
      /\bvisita\b/i.test(t) ||
      /\bconversamos\b/i.test(t) ||
      /\bl[aá]\b/i.test(t))
  ) {
    return "at_meeting";
  }
  if (/\bprefiro\b/i.test(t) && /\b(visita|pessoalmente|l[aá])\b/i.test(t)) {
    return "at_meeting";
  }

  if (QUAL_DISMISS.test(t)) return "dismiss";

  return null;
}

/** @deprecated use resolveQualificationChoice */
export function prefersQualificationAtMeeting(message: string): boolean {
  const choice = resolveQualificationChoice(message);
  return choice === "at_meeting" || choice === "dismiss";
}

/** @deprecated use resolveQualificationChoice */
export function prefersQualificationBeforeMeeting(message: string): boolean {
  return resolveQualificationChoice(message) === "before";
}
