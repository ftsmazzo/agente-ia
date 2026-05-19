/** Respostas curtas de aceite após convite de visita. */
const VISIT_ACCEPT =
  /^(?:sim|ok|pode(?:\s+ser)?|gostaria(?:\s+sim)?|quero(?:\s+sim)?|vamos|aceito|combinado|fechado|claro|perfeito|isso|adoraria|adoro|topo|bora|beleza|show|legal|otimo|ótimo|maravilha|massa|demorou|dale|uhum|aham|certo|fechou|pode|blz)(?:[!.?]*)?$/i;

/** Aceite em frase um pouco maior. */
const VISIT_ACCEPT_LOOSE =
  /\b(adoraria|adoro|quero\s+(?:muito\s+)?(?:sim|agendar|visitar)?|vamos\s+sim|pode\s+ser|fechado|combinado|perfeito|ótimo|otimo|topo|bora|com\s+certeza|muito|massa|vamos\s+nessa|bora\s+l[aá])\b/i;

const VISIT_DECLINE =
  /\b(n[aã]o|nem|nunca|cancel|depois|talvez|sem\s+interesse|nao\s+quero|dispenso|agora\s+n[aã]o)\b/i;

/** Convite de visita na última resposta do bot. */
const VISIT_INVITE_IN_REPLY =
  /\b(agendar|agende|marcar)\b.*\bvisita\b|\bvisita\b.*\b(imobili[aá]ria|pazotti|sede)\b|\bhor[aá]rios?\s+dispon[ií]veis\b|\bqual\s+n[uú]mero\s+funciona\b|\bconhecer\b.*\bpessoalmente\b/i;

/** Cliente encerra ou adia a conversa (obrigado, até amanhã, etc.). */
const QUAL_DISMISS =
  /\b(obrigad[oa]|valeu|agrade[cç]o|at[eé]\s*(logo|mais|breve)?|tchau|deixa\s+(pra|para)|amanh[aã]|depois|por\s+enquanto|s[oó]\s+isso|j[aá]\s+est[aá]\s+bom)\b/i;

/** Cliente aceita responder algo antes (sem abrir interrogatório financeiro). */
const QUAL_BEFORE_MEETING =
  /\b(antes|agora|aqui|pelo\s+whatsapp|adiantar|por\s+aqui)\b/i;

export type QualificationChoice = "at_meeting" | "before" | "dismiss";

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function acceptsVisitAffirmative(message: string): boolean {
  const t = message.trim();
  if (!t || t.length > 100) return false;
  if (VISIT_ACCEPT.test(t)) return true;
  if (VISIT_ACCEPT_LOOSE.test(t)) return true;
  return false;
}

/**
 * Após convite de visita: resposta curta sem negação = aceite (cobre "Adoraria", "Massa", etc.).
 */
export function acceptsVisitAfterInvite(message: string): boolean {
  const t = message.trim();
  if (!t || t.length > 100) return false;
  if (looksLikeSlotChoice(message)) return false;
  const norm = normalize(t);
  if (VISIT_DECLINE.test(norm)) return false;
  if (acceptsVisitAffirmative(message)) return true;
  if (/\?/.test(t)) return false;
  if (t.length <= 72) return true;
  return false;
}

/** Cliente escolheu opção numerada da lista (ex.: "opção 3", "3", "a 2"). */
export function looksLikeSlotChoice(message: string): boolean {
  const t = normalize(message.trim());
  if (!t || t.length > 64) return false;
  if (/^[1-5]$/.test(t)) return true;
  if (/\b(?:opcao|op)(?:\s*[ºo.]?\s*)?([1-9])\b/.test(t)) return true;
  if (/\b(?:numero|n|#)\s*([1-9])\b/.test(t)) return true;
  if (
    /^(?:a\s+)?(?:primeir[ao]|segund[ao]|terceir[ao]|quart[ao]|quint[ao])$/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

/** Cliente cobra confirmação depois de escolher horário (conversa travada na LLM). */
export function isAwaitingBookingFollowUp(message: string): boolean {
  const t = message.trim();
  if (!t || t.length > 80) return false;
  return /\b(aguardo|cad[eê]|e\s+a[ií]|confirma|confirmou|fechou)\b/i.test(t);
}

/** Última resposta do bot listou horários numerados (LLM ou sistema). */
export function botMessageOfferedNumberedSlots(replyText: string): boolean {
  return (
    /(?:^|\n)\s*[1-5]\)\s+\S/m.test(replyText) ||
    /\b[1-5]\)\s*(?:seg|ter|qua|qui|sex|sab|dom)/i.test(replyText) ||
    /\b[1-5]\.\s*(?:seg|ter|qua|qui|sex|sab|dom)/i.test(replyText) ||
    /Qual\s+n[uú]mero\s+funciona/i.test(replyText) ||
    /hor[aá]rios?\s+(?:dispon[ií]veis|na\s+)/i.test(replyText)
  );
}

export function botMessageInvitesVisit(replyText: string): boolean {
  return VISIT_INVITE_IN_REPLY.test(replyText);
}

/** Conversa está no funil de agendamento — LLM não deve assumir confirmação de visita. */
export function isInSchedulingFunnel(params: {
  schedulingStatus?: string | null;
  visitPrompted?: boolean;
  lastBotReply?: string | null;
}): boolean {
  const status = params.schedulingStatus ?? null;
  if (
    status === "awaiting_slot" ||
    status === "awaiting_accept" ||
    params.visitPrompted === true
  ) {
    return true;
  }
  if (params.lastBotReply) {
    if (botMessageOfferedNumberedSlots(params.lastBotReply)) return true;
    if (botMessageInvitesVisit(params.lastBotReply)) return true;
  }
  return false;
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
