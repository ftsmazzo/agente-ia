import type pg from "pg";
import type { BrandConfig } from "@realty/shared";
import { formatSlotLabel } from "./scheduling-service.js";

export type OpsNotificationKind =
  | "appointment_reminder_24h"
  | "failed_message"
  | "system_health";

export type OpsNotificationMessage = {
  id: string;
  kind: OpsNotificationKind;
  text: string;
  referenceId?: number;
};

const REMINDER_MIN_HOURS = 22;
const REMINDER_MAX_HOURS = 26;

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
  options?: { portalBaseUrl?: string | null },
): Promise<{ messages: OpsNotificationMessage[] }> {
  const messages: OpsNotificationMessage[] = [];
  const portalHint = options?.portalBaseUrl
    ? `\nPortal: ${options.portalBaseUrl.replace(/\/$/, "")}/agenda`
    : "\nAbra o portal na seção Agenda para confirmar.";

  const { rows: dueAppointments } = await pool.query<{
    id: number;
    phone: string;
    customer_name: string | null;
    property_code: string | null;
    starts_at: Date;
    timezone: string;
    location: string;
  }>(
    `SELECT id, phone, customer_name, property_code, starts_at, timezone, location
     FROM app.appointments
     WHERE status IN ('scheduled', 'confirmed')
       AND confirmation_status = 'pending'
       AND reminder_24h_sent_at IS NULL
       AND starts_at > NOW()
       AND starts_at <= NOW() + ($1::text || ' hours')::interval
       AND starts_at >= NOW() + ($2::text || ' hours')::interval
     ORDER BY starts_at ASC
     LIMIT 20`,
    [String(REMINDER_MAX_HOURS), String(REMINDER_MIN_HOURS)],
  );

  for (const row of dueAppointments) {
    const when = formatSlotLabel(row.starts_at, row.timezone);
    const who = row.customer_name?.trim() || formatPhone(row.phone);
    const property = row.property_code ? ` · imóvel ${row.property_code}` : "";
    const text = [
      `📅 *Lembrete ${brand.brandName}*`,
      "",
      `Visita em ~24h: *${when}*`,
      `Cliente: ${who}${property}`,
      `Local: ${row.location}`,
      "",
      `Confirme no portal se a visita está mantida.${portalHint}`,
    ].join("\n");

    messages.push({
      id: `appointment_reminder:${row.id}`,
      kind: "appointment_reminder_24h",
      text,
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
