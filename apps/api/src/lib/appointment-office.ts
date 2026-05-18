import type { SchedulingSettings } from "../services/scheduling-service.js";

export type OfficeLocation = {
  title: string;
  address: string | null;
  mapsUrl: string | null;
  /** Endereço ou título (sem repetir "Sede da imobiliária" + endereço). */
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

  const display = address ?? title;

  return { title, address, mapsUrl, display };
}

export function isValidHttpUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
