/** Respostas curtas de aceite após convite de visita (ex.: "gostaria sim", "sim", "pode ser"). */
const VISIT_ACCEPT =
  /^(?:sim|ok|pode(?:\s+ser)?|gostaria(?:\s+sim)?|quero(?:\s+sim)?|vamos|aceito|combinado|fechado|claro|perfeito|isso)(?:[!.?]*)?$/i;

/** Convite de visita na última resposta do bot. */
const VISIT_INVITE_IN_REPLY =
  /\b(agendar|agende|marcar)\b.*\bvisita\b|\bvisita\b.*\b(imobili[aá]ria|pazotti|sede)\b|\bcomo est[aá] sua agenda\b|\bconhecer\b.*\bpessoalmente\b/i;

/** Cliente prefere qualificar na reunião. */
const QUAL_AT_MEETING =
  /\b(na\s+)?(visita|reuni[aã]o|encontro|pessoalmente|l[aá]|presencial|depois|dia)\b/i;

/** Cliente aceita responder algo antes (sem abrir interrogatório financeiro). */
const QUAL_BEFORE_MEETING =
  /\b(antes|agora|aqui|pelo\s+whatsapp|pode\s+ser|sim|pode)\b/i;

export function acceptsVisitAffirmative(message: string): boolean {
  const t = message.trim();
  if (!t || t.length > 48) return false;
  return VISIT_ACCEPT.test(t);
}

export function botMessageInvitesVisit(replyText: string): boolean {
  return VISIT_INVITE_IN_REPLY.test(replyText);
}

export function prefersQualificationAtMeeting(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (t.length > 120) return false;
  if (/\b(n[aã]o|prefiro\s+na)\b/i.test(t) && QUAL_AT_MEETING.test(t)) return true;
  if (/^(?:na\s+)?(?:visita|reuni[aã]o|pessoalmente|depois)\.?$/i.test(t)) return true;
  return (
    /\bprefiro\b/i.test(t) &&
    QUAL_AT_MEETING.test(t) &&
    !QUAL_BEFORE_MEETING.test(t)
  );
}

export function prefersQualificationBeforeMeeting(message: string): boolean {
  const t = message.trim().toLowerCase();
  if (t.length > 120) return false;
  if (prefersQualificationAtMeeting(message)) return false;
  return QUAL_BEFORE_MEETING.test(t);
}
