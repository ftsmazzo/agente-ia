import type pg from "pg";

export type FailedMessageRow = {
  id: number;
  externalId: string | null;
  phone: string | null;
  errorMessage: string;
  retryCount: number;
  createdAt: string;
  payloadPreview: string;
};

export async function listFailedMessages(
  pool: pg.Pool,
  options?: { limit?: number; unresolvedOnly?: boolean },
): Promise<FailedMessageRow[]> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const unresolvedOnly = options?.unresolvedOnly !== false;

  const { rows } = await pool.query<{
    id: number;
    external_id: string | null;
    phone: string | null;
    error_message: string;
    retry_count: number;
    created_at: Date;
    payload: Record<string, unknown>;
  }>(
    `SELECT id, external_id, phone, error_message, retry_count, created_at, payload
     FROM app.failed_messages
     WHERE ($1::boolean = FALSE OR resolved_at IS NULL)
     ORDER BY created_at DESC
     LIMIT $2`,
    [unresolvedOnly, limit],
  );

  return rows.map((r) => ({
    id: r.id,
    externalId: r.external_id,
    phone: r.phone,
    errorMessage: r.error_message,
    retryCount: r.retry_count,
    createdAt: r.created_at.toISOString(),
    payloadPreview: summarizePayload(r.payload),
  }));
}

function summarizePayload(payload: Record<string, unknown>): string {
  const msg =
    typeof payload.message === "string"
      ? payload.message
      : typeof payload.text === "string"
        ? payload.text
        : null;
  if (msg) return msg.slice(0, 200);
  return JSON.stringify(payload).slice(0, 200);
}

export async function resolveFailedMessage(
  pool: pg.Pool,
  id: number,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE app.failed_messages
     SET resolved_at = NOW()
     WHERE id = $1 AND resolved_at IS NULL`,
    [id],
  );
  return (rowCount ?? 0) > 0;
}
