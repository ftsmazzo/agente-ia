export function buildClientVisitReminderText(params: {
  brandName: string;
  firstName: string | null;
  whenLabel: string;
  location: string;
  propertyCode?: string | null;
  soon?: boolean;
}): string {
  const who = params.firstName?.trim();
  const greeting = who ? `Olá, ${who}!` : "Olá!";
  const property = params.propertyCode
    ? `\nImóvel: *${params.propertyCode}*`
    : "";
  const timing = params.soon
    ? "Sua visita está chegando"
    : "Lembrete da sua visita";

  return [
    `${greeting}`,
    "",
    `📅 *${params.brandName}* — ${timing} em *${params.whenLabel}*.`,
    `Local: ${params.location}${property}`,
    "",
    "Responda *SIM* para confirmar ou *NÃO* para cancelar e liberar o horário.",
  ].join("\n");
}
