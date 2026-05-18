import type pg from "pg";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type SchedulingSettings = {
  timezone: string;
  weekdays: number[];
  workStart: string;
  workEnd: string;
  slotMinutes: number;
  durationMinutes: number;
  minNoticeMinutes: number;
  horizonDays: number;
  location: string;
  address: string | null;
  mapsUrl: string | null;
  active: boolean;
};

export type AppointmentSlot = {
  startsAt: string;
  endsAt: string;
  label: string;
  option: number;
};

export type AppointmentRecord = {
  id: number;
  phone: string;
  customerName: string | null;
  propertyCode: string | null;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  location: string;
  source: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type AppointmentRow = {
  id: number;
  phone: string;
  customer_name: string | null;
  property_code: string | null;
  status: AppointmentStatus;
  starts_at: Date;
  ends_at: Date;
  timezone: string;
  location: string;
  source: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

const ACTIVE_STATUSES: AppointmentStatus[] = ["scheduled", "confirmed"];

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map((part) => Number(part));
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const localAsUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return localAsUtc - date.getTime();
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstPass = new Date(
    wallClockAsUtc - getTimeZoneOffsetMs(new Date(wallClockAsUtc), timeZone),
  );
  return new Date(wallClockAsUtc - getTimeZoneOffsetMs(firstPass, timeZone));
}

function addDaysToYmd(
  ymd: { year: number; month: number; day: number },
  days: number,
) {
  const date = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function isoWeekday(ymd: { year: number; month: number; day: number }): number {
  const jsDay = new Date(
    Date.UTC(ymd.year, ymd.month - 1, ymd.day),
  ).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function formatSlotLabel(startsAt: string | Date, timeZone: string) {
  const date = typeof startsAt === "string" ? new Date(startsAt) : startsAt;
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
  }).format(date);
  const dayMonth = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  const hour = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${weekday}, ${dayMonth} às ${hour}`;
}

function toAppointment(row: AppointmentRow): AppointmentRecord {
  return {
    id: row.id,
    phone: row.phone,
    customerName: row.customer_name,
    propertyCode: row.property_code,
    status: row.status,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    timezone: row.timezone,
    location: row.location,
    source: row.source,
    notes: row.notes,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getSchedulingSettings(
  pool: pg.Pool,
): Promise<SchedulingSettings> {
  const { rows } = await pool.query<{
    timezone: string;
    weekdays: number[];
    work_start: string;
    work_end: string;
    slot_minutes: number;
    duration_minutes: number;
    min_notice_minutes: number;
    horizon_days: number;
    location: string;
    address: string | null;
    maps_url: string | null;
    active: boolean;
  }>(
    `SELECT timezone, weekdays, work_start, work_end, slot_minutes,
            duration_minutes, min_notice_minutes, horizon_days, location,
            address, maps_url, active
     FROM app.appointment_settings WHERE id = 1`,
  );

  const row = rows[0];
  return {
    timezone: row?.timezone ?? "America/Sao_Paulo",
    weekdays: row?.weekdays ?? [1, 2, 3, 4, 5],
    workStart: row?.work_start ?? "09:00",
    workEnd: row?.work_end ?? "18:00",
    slotMinutes: row?.slot_minutes ?? 60,
    durationMinutes: row?.duration_minutes ?? 60,
    minNoticeMinutes: row?.min_notice_minutes ?? 120,
    horizonDays: row?.horizon_days ?? 7,
    location: row?.location ?? "Sede da imobiliária",
    address: row?.address ?? null,
    mapsUrl: row?.maps_url ?? null,
    active: row?.active ?? true,
  };
}

export async function listAvailableSlots(
  pool: pg.Pool,
  options?: { days?: number; limit?: number; now?: Date },
): Promise<AppointmentSlot[]> {
  const settings = await getSchedulingSettings(pool);
  if (!settings.active) return [];

  const days = Math.min(Math.max(options?.days ?? settings.horizonDays, 1), 60);
  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
  const now = options?.now ?? new Date();
  const minStart = new Date(
    now.getTime() + settings.minNoticeMinutes * 60 * 1000,
  );
  const today = getZonedParts(now, settings.timezone);
  const startMinute = timeToMinutes(settings.workStart);
  const endMinute = timeToMinutes(settings.workEnd);

  const candidates: Array<{ start: Date; end: Date }> = [];
  for (let offset = 0; offset < days; offset += 1) {
    const ymd = addDaysToYmd(today, offset);
    if (!settings.weekdays.includes(isoWeekday(ymd))) continue;

    for (
      let minute = startMinute;
      minute + settings.durationMinutes <= endMinute;
      minute += settings.slotMinutes
    ) {
      const start = zonedTimeToUtc(
        ymd.year,
        ymd.month,
        ymd.day,
        Math.floor(minute / 60),
        minute % 60,
        settings.timezone,
      );
      if (start <= minStart) continue;
      candidates.push({
        start,
        end: new Date(start.getTime() + settings.durationMinutes * 60 * 1000),
      });
    }
  }

  if (!candidates.length) return [];

  const first = candidates[0].start;
  const last = candidates[candidates.length - 1].end;
  const { rows } = await pool.query<{ starts_at: Date }>(
    `SELECT starts_at FROM app.appointments
     WHERE status = ANY($1::text[])
       AND starts_at >= $2
       AND starts_at < $3`,
    [ACTIVE_STATUSES, first, last],
  );
  const booked = new Set(rows.map((row) => row.starts_at.toISOString()));

  return candidates
    .filter((slot) => !booked.has(slot.start.toISOString()))
    .slice(0, limit)
    .map((slot, index) => ({
      startsAt: slot.start.toISOString(),
      endsAt: slot.end.toISOString(),
      label: formatSlotLabel(slot.start, settings.timezone),
      option: index + 1,
    }));
}

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Ordinais de opção — sem dias da semana (evita "quarta" = opção 4). */
const ORDINAL_OPTIONS: Record<string, number> = {
  primeiro: 1,
  primeira: 1,
  segundo: 2,
  segunda: 2,
  terceiro: 3,
  terceira: 3,
  quarto: 4,
  quinto: 5,
};

const WEEKDAY_KEYWORDS: Record<string, number> = {
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 4,
  quinta: 5,
  sexta: 6,
  sabado: 6,
  sábado: 6,
  domingo: 7,
};

function parseRequestedTimes(text: string): Array<{ hour: number; minute: number }> {
  const times: Array<{ hour: number; minute: number }> = [];
  for (const match of text.matchAll(
    /\b(?:as|às)\s*([01]?\d|2[0-3])(?:\s*h(?:\s*(\d{2}))?|:?(\d{2}))?\b/gi,
  )) {
    times.push({
      hour: Number(match[1]),
      minute: Number(match[2] ?? match[3] ?? 0),
    });
  }
  for (const match of text.matchAll(/\b([01]?\d|2[0-3])\s*h(?:\s*(\d{2}))?\b/gi)) {
    times.push({
      hour: Number(match[1]),
      minute: Number(match[2] ?? 0),
    });
  }
  return times;
}

function slotWeekdayInTimezone(startsAt: string, timeZone: string): number {
  return isoWeekday(getZonedParts(new Date(startsAt), timeZone));
}

function messageMentionsWeekday(text: string, weekday: number): boolean {
  for (const [word, iso] of Object.entries(WEEKDAY_KEYWORDS)) {
    if (iso === weekday && text.includes(word)) return true;
  }
  return false;
}

export function findRequestedSlot(
  message: string,
  slots: AppointmentSlot[],
  timeZone: string,
): AppointmentSlot | null {
  const text = normalize(message);
  const short = text.trim().length <= 12;
  const optionMatch = text.match(
    /\b(?:opcao|op|numero|n|nº|#)?\s*([1-9])\b/,
  );
  if (optionMatch && (short || /opcao|numero|nº|#/.test(text))) {
    const option = Number(optionMatch[1]);
    const byOption = slots.find((slot) => slot.option === option);
    if (byOption) return byOption;
  }

  for (const [word, option] of Object.entries(ORDINAL_OPTIONS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) {
      const byOption = slots.find((slot) => slot.option === option);
      if (byOption) return byOption;
    }
  }

  const requestedTimes = parseRequestedTimes(text);
  if (!requestedTimes.length) return null;

  const mentionedWeekdays = Object.entries(WEEKDAY_KEYWORDS)
    .filter(([word]) => text.includes(word))
    .map(([, iso]) => iso);

  const candidates = slots.filter((slot) => {
    const local = getZonedParts(new Date(slot.startsAt), timeZone);
    const hasTime = requestedTimes.some(
      (time) => time.hour === local.hour && time.minute === local.minute,
    );
    if (!hasTime) return false;

    if (text.includes("amanha")) {
      const tomorrow = addDaysToYmd(getZonedParts(new Date(), timeZone), 1);
      return (
        local.year === tomorrow.year &&
        local.month === tomorrow.month &&
        local.day === tomorrow.day
      );
    }

    if (mentionedWeekdays.length > 0) {
      const slotWd = slotWeekdayInTimezone(slot.startsAt, timeZone);
      if (!mentionedWeekdays.includes(slotWd)) return false;
    }

    const ddmm = `${String(local.day).padStart(2, "0")}/${String(
      local.month,
    ).padStart(2, "0")}`;
    if (text.includes(ddmm)) return true;

    const label = normalize(slot.label);
    const weekdayPart = label.split(",")[0]?.trim() ?? "";
    if (
      weekdayPart.length > 2 &&
      text.includes(weekdayPart.split("-")[0]?.trim() ?? "")
    ) {
      return true;
    }

    if (messageMentionsWeekday(text, slotWeekdayInTimezone(slot.startsAt, timeZone))) {
      return true;
    }

    return false;
  });

  if (candidates.length === 1) return candidates[0];

  if (candidates.length > 1 && mentionedWeekdays.length === 0) {
    const sameTimeOnly = slots.filter((slot) => {
      const local = getZonedParts(new Date(slot.startsAt), timeZone);
      return requestedTimes.some(
        (time) => time.hour === local.hour && time.minute === local.minute,
      );
    });
    if (sameTimeOnly.length === 1) return sameTimeOnly[0];
  }

  return null;
}

export function formatSlotsForPrompt(slots: AppointmentSlot[]): string {
  if (!slots.length) {
    return `[AGENDA DO SISTEMA]
Nenhum horário disponível nos próximos dias.
[/AGENDA DO SISTEMA]`;
  }

  return `[AGENDA DO SISTEMA]
Horários disponíveis para visita na imobiliária:
${slots.map((slot) => `${slot.option}. ${slot.label}`).join("\n")}

Use somente estes horários. Se o cliente pedir outro horário, ofereça os horários acima ou diga que vai verificar com a equipe.
[/AGENDA DO SISTEMA]`;
}

export function buildSlotOfferReply(slots: AppointmentSlot[]): string {
  if (!slots.length) {
    return "Quero muito te receber na imobiliária, mas não encontrei horários livres nos próximos dias. Vou verificar com a equipe e já te retorno com opções.";
  }

  const list = slots
    .slice(0, 5)
    .map((slot) => `${slot.option}. ${slot.label}`)
    .join("\n");
  return `Perfeito, vamos agendar sua visita na imobiliária.\n\nTenho estes horários disponíveis:\n${list}\n\nQual deles fica melhor para você?`;
}

export async function bookAppointment(
  pool: pg.Pool,
  input: {
    phone: string;
    startsAt: string;
    customerName?: string | null;
    propertyCode?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<
  | { ok: true; appointment: AppointmentRecord }
  | { ok: false; reason: "slot_unavailable"; slots: AppointmentSlot[] }
> {
  const settings = await getSchedulingSettings(pool);
  const available = await listAvailableSlots(pool, {
    days: settings.horizonDays,
    limit: 100,
  });
  const selected = available.find((slot) => slot.startsAt === input.startsAt);
  if (!selected) {
    return { ok: false, reason: "slot_unavailable", slots: available };
  }

  await pool.query(
    `INSERT INTO app.contacts (phone, display_name, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (phone) DO UPDATE SET
       display_name = COALESCE(EXCLUDED.display_name, app.contacts.display_name),
       updated_at = NOW()`,
    [input.phone, input.customerName ?? null],
  );

  try {
    const { rows } = await pool.query<AppointmentRow>(
      `INSERT INTO app.appointments (
         phone, customer_name, property_code, starts_at, ends_at, timezone,
         location, source, notes, metadata, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'sofia', $8, $9::jsonb, NOW())
       RETURNING id, phone, customer_name, property_code, status, starts_at,
                 ends_at, timezone, location, source, notes, metadata,
                 created_at, updated_at`,
      [
        input.phone,
        input.customerName ?? null,
        input.propertyCode ?? null,
        selected.startsAt,
        selected.endsAt,
        settings.timezone,
        settings.location,
        input.notes ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return { ok: true, appointment: toAppointment(rows[0]) };
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      const slots = await listAvailableSlots(pool, {
        days: settings.horizonDays,
        limit: 100,
      });
      return { ok: false, reason: "slot_unavailable", slots };
    }
    throw err;
  }
}

export async function listAppointments(
  pool: pg.Pool,
  options?: { status?: AppointmentStatus; from?: string; to?: string; limit?: number },
): Promise<AppointmentRecord[]> {
  const filters: string[] = [];
  const values: unknown[] = [];

  if (options?.status) {
    values.push(options.status);
    filters.push(`status = $${values.length}`);
  }
  if (options?.from) {
    values.push(options.from);
    filters.push(`starts_at >= $${values.length}`);
  }
  if (options?.to) {
    values.push(options.to);
    filters.push(`starts_at < $${values.length}`);
  }

  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200);
  values.push(limit);
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const { rows } = await pool.query<AppointmentRow>(
    `SELECT id, phone, customer_name, property_code, status, starts_at,
            ends_at, timezone, location, source, notes, metadata,
            created_at, updated_at
     FROM app.appointments
     ${where}
     ORDER BY starts_at ASC
     LIMIT $${values.length}`,
    values,
  );

  return rows.map(toAppointment);
}

export async function updateAppointment(
  pool: pg.Pool,
  id: number,
  patch: { status?: AppointmentStatus; notes?: string | null; startsAt?: string },
): Promise<
  | { ok: true; appointment: AppointmentRecord | null }
  | { ok: false; reason: "slot_unavailable"; slots: AppointmentSlot[] }
> {
  const existing = await getAppointment(pool, id);
  if (!existing) return { ok: true, appointment: null };

  let startsAt: string | null = null;
  let endsAt: string | null = null;
  if (patch.startsAt && patch.startsAt !== existing.startsAt) {
    const settings = await getSchedulingSettings(pool);
    const available = await listAvailableSlots(pool, {
      days: settings.horizonDays,
      limit: 100,
    });
    const selected = available.find((slot) => slot.startsAt === patch.startsAt);
    if (!selected) {
      return { ok: false, reason: "slot_unavailable", slots: available };
    }
    startsAt = selected.startsAt;
    endsAt = selected.endsAt;
  }

  try {
    const { rows } = await pool.query<AppointmentRow>(
      `UPDATE app.appointments
       SET status = COALESCE($2, status),
           notes = COALESCE($3, notes),
           starts_at = COALESCE($4, starts_at),
           ends_at = COALESCE($5, ends_at),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, phone, customer_name, property_code, status, starts_at,
                 ends_at, timezone, location, source, notes, metadata,
                 created_at, updated_at`,
      [id, patch.status ?? null, patch.notes ?? null, startsAt, endsAt],
    );
    return { ok: true, appointment: rows[0] ? toAppointment(rows[0]) : null };
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      const slots = await listAvailableSlots(pool, { limit: 100 });
      return { ok: false, reason: "slot_unavailable", slots };
    }
    throw err;
  }
}

export async function getAppointment(
  pool: pg.Pool,
  id: number,
): Promise<AppointmentRecord | null> {
  const { rows } = await pool.query<AppointmentRow>(
    `SELECT id, phone, customer_name, property_code, status, starts_at,
            ends_at, timezone, location, source, notes, metadata,
            created_at, updated_at
     FROM app.appointments WHERE id = $1`,
    [id],
  );
  return rows[0] ? toAppointment(rows[0]) : null;
}

function icsDate(value: string): string {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildAppointmentIcs(appointment: AppointmentRecord): string {
  const summary = `Visita na ${appointment.location}`;
  const description = [
    appointment.customerName ? `Cliente: ${appointment.customerName}` : null,
    `Telefone: ${appointment.phone}`,
    appointment.propertyCode ? `Imóvel: ${appointment.propertyCode}` : null,
    appointment.notes ? `Observações: ${appointment.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Realty Agent Platform//Agenda//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:appointment-${appointment.id}@realty-agent-platform`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(appointment.startsAt)}`,
    `DTEND:${icsDate(appointment.endsAt)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `LOCATION:${escapeIcsText(appointment.location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
