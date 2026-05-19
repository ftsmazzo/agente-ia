import type pg from "pg";
import type { BrandConfig } from "@realty/shared";
import { buildClientVisitReminderText } from "../lib/appointment-reminder.js";
import { mergeConversationMetadata } from "./conversation-state.js";
import { formatSlotLabel } from "./scheduling-service.js";

export type OpsNotificationKind =
  | "appointment_reminder_24h"
  | "appointment_reminder_soon"
  | "failed_message"
  | "system_health";

export type OpsNotificationMessage = {
  id: string;
  kind: OpsNotificationKind;
  text: string;
  /** `client` = lembrete de visita; `ops` = alertas internos (erro do sistema). */
  audience: "client" | "ops";
  /** Dígitos do WhatsApp do cliente (obrigatório quando audience = client). */
  recipientPhone?: string;
  referenceId?: number;
};

/** Janela principal (~24h antes). Cron a cada 30 min cobre vários ticks nesse intervalo. */
const REMINDER_MIN_HOURS = 20;
const REMINDER_MAX_HOURS = 28;

/** Visitas agendadas com pouca antecedência: um lembrete se faltar 1–20h e nunca foi enviado. */
const CATCHUP_MIN_HOURS = 1;
const CATCHUP_MAX_HOURS = 20;

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return phone;
}

export async function runOpsNotificationTick(
  pool: pg.Pool,
  brand: BrandConfig,
): Promise<{ messages: OpsNotificationMessage[] }> {
  const messages: OpsNotificationMessage[] = [];

  type DueAppointmentRow = {
    id: number;
    phone: string;
    customer_name: string | null;
    property_code: string | null;
    starts_at: Date;
    timezone: string;
    location: string;
    reminder_kind: "24h" | "soon";
  };

  const { rows: dueAppointments } = await pool.query<DueAppointmentRow>(
    `SELECT id, phone, customer_name, property_code, starts_at, timezone, location,
            reminder_kind
     FROM (
       SELECT id, phone, customer_name, property_code, starts_at, timezone, location,
              '24h'::text AS reminder_kind
       FROM app.appointments
       WHERE status IN ('scheduled', 'confirmed')
         AND confirmation_status = 'pending'
         AND reminder_24h_sent_at IS NULL
         AND starts_at > NOW()
         AND starts_at <= NOW() + ($1::text || ' hours')::interval
         AND starts_at >= NOW() + ($2::text || ' hours')::interval
       UNION ALL
       SELECT id, phone, customer_name, property_code, starts_at, timezone, location,
              'soon'::text AS reminder_kind
       FROM app.appointments
       WHERE status IN ('scheduled', 'confirmed')
         AND confirmation_status = 'pending'
         AND reminder_24h_sent_at IS NULL
         AND starts_at > NOW() + ($3::text || ' hours')::interval
         AND starts_at < NOW() + ($4::text || ' hours')::interval
     ) due
     ORDER BY starts_at ASC
     LIMIT 20`,
    [
      String(REMINDER_MAX_HOURS),
      String(REMINDER_MIN_HOURS),
      String(CATCHUP_MIN_HOURS),
      String(CATCHUP_MAX_HOURS),
    ],
  );

  for (const row of dueAppointments) {
    const when = formatSlotLabel(row.starts_at, row.timezone);
    const soon = row.reminder_kind === "soon";
    const firstName = row.customer_name?.trim().split(/\s+/)[0] ?? null;
    const clientDigits = row.phone.replace(/\D/g, "");
    const text = buildClientVisitReminderText({
      brandName: brand.brandName,
      assistantName: brand.assistantName,
      firstName,
      whenLabel: when,
      location: row.location,
      propertyCode: row.property_code,
      soon,
    });

    messages.push({
      id: `appointment_reminder:${row.id}`,
      kind: soon ? "appointment_reminder_soon" : "appointment_reminder_24h",
      text,
      audience: "client",
      recipientPhone: clientDigits,
      referenceId: row.id,
    });
  }

  const { rows: failedRows } = await pool.query<{
    id: number;
    phone: string | null;
    error_message: string;
    created_at: Date;
  }>(
    `SELECT id, phone, error_message, created_at
     FROM app.failed_messages
     WHERE resolved_at IS NULL
       AND ops_alerted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 5`,
  );

  for (const row of failedRows) {
    const phoneLine = row.phone ? ` · ${formatPhone(row.phone)}` : "";
    const excerpt =
      row.error_message.length > 180
        ? `${row.error_message.slice(0, 177)}…`
        : row.error_message;
    const text = [
      `⚠️ *Erro no sistema — ${brand.brandName}*`,
      "",
      `Falha ao processar mensagem${phoneLine}.`,
      excerpt,
      "",
      "Veja Portal → Sistema para detalhes e resolução.",
    ].join("\n");

    messages.push({
      id: `failed_message:${row.id}`,
      kind: "failed_message",
      text,
      audience: "ops",
      referenceId: row.id,
    });
  }

  const { rows: healthRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM app.failed_messages WHERE resolved_at IS NULL`,
  );
  const unresolvedFailed = Number(healthRows[0]?.count ?? 0);
  if (unresolvedFailed >= 10 && failedRows.length === 0) {
    const { rows: digestState } = await pool.query<{ sent_at: Date | null }>(
      `SELECT sent_at FROM app.ops_digest_state WHERE id = 'failed_messages_threshold'`,
    );
    const lastSent = digestState[0]?.sent_at;
    const stale =
      !lastSent || Date.now() - lastSent.getTime() > 12 * 60 * 60 * 1000;
    if (stale) {
      messages.push({
        id: `system_health:failed_threshold:${unresolvedFailed}`,
        kind: "system_health",
        audience: "ops",
        text: [
          `⚠️ *Alerta ${brand.brandName}*`,
          "",
          `${unresolvedFailed} mensagens com falha aguardando revisão.`,
          "Portal → Sistema.",
        ].join("\n"),
      });
    }
  }

  if (messages.length === 0) {
    return { messages: [] };
  }

  const appointmentIds = dueAppointments.map((r) => r.id);
  const failedIds = failedRows.map((r) => r.id);
  const hasHealthDigest = messages.some((m) => m.kind === "system_health");

  await pool.query("BEGIN");
  try {
    if (appointmentIds.length > 0) {
      await pool.query(
        `UPDATE app.appointments
         SET reminder_24h_sent_at = NOW(), updated_at = NOW()
         WHERE id = ANY($1::bigint[])`,
        [appointmentIds],
      );
      for (const row of dueAppointments) {
        await mergeConversationMetadata(pool, row.phone, {
          scheduling: {
            status: "awaiting_visit_confirmation",
            appointmentId: row.id,
            startsAt: row.starts_at.toISOString(),
            propertyCode: row.property_code,
            updatedAt: new Date().toISOString(),
          },
        });
      }
    }
    if (failedIds.length > 0) {
      await pool.query(
        `UPDATE app.failed_messages
         SET ops_alerted_at = NOW()
         WHERE id = ANY($1::bigint[])`,
        [failedIds],
      );
    }
    if (hasHealthDigest) {
      await pool.query(
        `INSERT INTO app.ops_digest_state (id, sent_at)
         VALUES ('failed_messages_threshold', NOW())
         ON CONFLICT (id) DO UPDATE SET sent_at = NOW()`,
      );
    }
    await pool.query("COMMIT");
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }

  return { messages };
}
