import type { OfficeLocation } from "./appointment-office.js";
import { formatPropertyInterestLine } from "./property-codes-from-history.js";

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

  if (params.icsUrl) {
    lines.push("", `Adicionar à agenda: ${params.icsUrl}`);
  }

  return lines.join("\n");
}

export function buildBookedClientReply(params: {
  brandName: string;
  greeting: string;
  label: string;
  office: OfficeLocation;
  propertyCode?: string | null;
  presentedPropertyCodes?: string[];
}): string {
  const who = params.greeting;
  const lines = [
    `Perfeito, ${who}sua visita está confirmada na ${params.brandName} para ${params.label}.`,
    "",
    `Local: ${params.office.display}`,
  ];

  if (params.office.mapsUrl) {
    lines.push(`Como chegar: ${params.office.mapsUrl}`);
  }

  const propertyLine = formatPropertyInterestLine(
    params.propertyCode,
    params.presentedPropertyCodes ?? [],
  );
  if (propertyLine) lines.push("", propertyLine);

  lines.push(
    "",
    "Se quiser, posso anotar aqui algumas informações rápidas para agilizar o atendimento antes da visita — ou prefere conversar sobre tudo pessoalmente no dia? O que fica melhor para você?",
  );

  return lines.join("\n");
}
