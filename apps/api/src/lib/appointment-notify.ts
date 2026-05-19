import type { OfficeLocation } from "./appointment-office.js";
import { isValidHttpUrl } from "./appointment-office.js";
import { formatPropertyInterestLine } from "./property-codes-from-history.js";

/** Maps em linha separada — WhatsApp exibe o link com preview sem poluir o endereço. */
export function formatMapsLines(mapsUrl: string | null | undefined): string[] {
  if (!isValidHttpUrl(mapsUrl)) return [];
  return ["", "Ver rota no Google Maps:", mapsUrl!.trim()];
}

export function buildAppointmentNotifyText(params: {
  customerName: string | null;
  phone: string;
  label: string;
  office: OfficeLocation;
  propertyCode?: string | null;
  presentedPropertyCodes?: string[];
  icsUrl?: string | null;
}): string {
  const lines = [
    "Nova visita agendada pela SofIA",
    "",
    `Cliente: ${params.customerName?.trim() || "não informado"}`,
    `Telefone: ${params.phone}`,
    `Horário: ${params.label}`,
    `Local: ${params.office.display}`,
  ];

  const propertyLine = formatPropertyInterestLine(
    params.propertyCode,
    params.presentedPropertyCodes ?? [],
  );
  if (propertyLine) lines.push(propertyLine);

  if (isValidHttpUrl(params.icsUrl)) {
    lines.push("", "Arquivo para agenda (.ics):", params.icsUrl!.trim());
  }

  return lines.join("\n");
}

export function buildRescheduleNotifyText(params: {
  customerName: string | null;
  phone: string;
  previousLabel: string;
  newLabel: string;
  office: OfficeLocation;
  propertyCode?: string | null;
  presentedPropertyCodes?: string[];
  icsUrl?: string | null;
}): string {
  const lines = [
    "Visita remarcada pela SofIA",
    "",
    `Cliente: ${params.customerName?.trim() || "não informado"}`,
    `Telefone: ${params.phone}`,
    `De: ${params.previousLabel}`,
    `Para: ${params.newLabel}`,
    `Local: ${params.office.display}`,
  ];
  const propertyLine = formatPropertyInterestLine(
    params.propertyCode,
    params.presentedPropertyCodes ?? [],
  );
  if (propertyLine) lines.push(propertyLine);
  if (isValidHttpUrl(params.icsUrl)) {
    lines.push("", "Arquivo para agenda (.ics):", params.icsUrl!.trim());
  }
  return lines.join("\n");
}

/** Confirmação ao cliente — sem código AP (só na notificação ao corretor). */
export function buildBookedClientReply(params: {
  brandName: string;
  greeting: string;
  label: string;
  office: OfficeLocation;
}): string {
  const who = params.greeting;
  const lines = [
    `Perfeito, ${who}sua visita está confirmada na ${params.brandName} para ${params.label}.`,
    "",
    `Local: ${params.office.display}`,
    ...formatMapsLines(params.office.mapsUrl),
  ];

  lines.push(
    "",
    "Se quiser, posso anotar aqui algumas informações rápidas para agilizar o atendimento antes da visita — ou prefere conversar sobre tudo pessoalmente no dia? O que fica melhor para você?",
  );

  return lines.join("\n");
}

export function buildRescheduledClientReply(params: {
  brandName: string;
  greeting: string;
  previousLabel: string;
  newLabel: string;
  office: OfficeLocation;
}): string {
  const who = params.greeting;
  const lines = [
    `Combinado, ${who}remarcamos sua visita na ${params.brandName}: de ${params.previousLabel} para ${params.newLabel}.`,
    "",
    `Local: ${params.office.display}`,
    ...formatMapsLines(params.office.mapsUrl),
    "",
    "Qualquer coisa até lá, é só me chamar por aqui.",
  ];
  return lines.join("\n");
}
