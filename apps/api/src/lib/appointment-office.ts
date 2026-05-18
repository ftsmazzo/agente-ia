import type { SchedulingSettings } from "../services/scheduling-service.js";

export type OfficeLocation = {
  title: string;
  address: string | null;
  mapsUrl: string | null;
  /** Texto para WhatsApp (título + endereço). */
  display: string;
};

export function resolveOfficeLocation(
  settings: SchedulingSettings,
): OfficeLocation {
  const title = settings.location?.trim() || "Sede da imobiliária";
  const address =
    process.env.APPOINTMENT_OFFICE_ADDRESS?.trim() ||
    settings.address?.trim() ||
    null;
  const mapsUrl =
    process.env.APPOINTMENT_OFFICE_MAPS_URL?.trim() ||
    settings.mapsUrl?.trim() ||
    (address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
      : null);

  const display = address ? `${title}\n${address}` : title;

  return { title, address, mapsUrl, display };
}

export function buildPublicApiBaseUrl(): string | null {
  const raw =
    process.env.PUBLIC_AGENT_API_URL?.trim() ||
    process.env.APPOINTMENT_PUBLIC_API_URL?.trim() ||
    "";
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function buildAppointmentIcsUrl(appointmentId: number): string | null {
  const base = buildPublicApiBaseUrl();
  if (!base) return null;
  return `${base}/v1/scheduling/appointments/${appointmentId}/ics`;
}
