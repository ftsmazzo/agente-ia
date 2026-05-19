export function buildClientVisitReminderText(params: {
  brandName: string;
  assistantName?: string;
  firstName: string | null;
  whenLabel: string;
  location: string;
  propertyCode?: string | null;
  soon?: boolean;
}): string {
  const who = params.firstName?.trim();
  const greeting = who ? `Olá, ${who}! Tudo bem?` : "Olá! Tudo bem?";
  const whoFrom = params.assistantName?.trim() || params.brandName;
  const property = params.propertyCode
    ? `\n📍 Imóvel de interesse: *${params.propertyCode}*`
    : "";

  const intro = params.soon
    ? "Sua visita na nossa imobiliária está chegando"
    : "Passando para lembrar da sua visita na nossa imobiliária";

  return [
    greeting,
    "",
    `${intro} — *${params.whenLabel}*.`,
    `Local: ${params.location}${property}`,
    "",
    "Está tudo certo para você?",
    "• Responda *SIM* para confirmar",
    "• Responda *NÃO* se precisar desmarcar (liberamos o horário na hora)",
    "",
    `Qualquer dúvida, pode falar comigo por aqui. — ${whoFrom}`,
  ].join("\n");
}
