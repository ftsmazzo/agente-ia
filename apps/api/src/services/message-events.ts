import type pg from "pg";

export type MessageDirection = "inbound" | "outbound";

const MAX_EVENT_TEXT = 8000;

/** Metadados de auditoria; inclui texto da mensagem quando disponível. */
export function buildEventMetadata(
  base: Record<string, unknown> = {},
  text?: string | null,
): Record<string, unknown> {
  const meta = { ...base };
  const trimmed = text?.trim();
  if (trimmed) meta.text = trimmed.slice(0, MAX_EVENT_TEXT);
  return meta;
}

export async function recordMessageEvent(
  pool: pg.Pool,
  params: {
    externalId: string;
    phone: string;
    direction: MessageDirection;
    status: string;
    workflowStep: string;
    payloadHash?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO app.message_events
      (external_id, phone, direction, workflow_step, status, payload_hash, error_message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (external_id) DO UPDATE SET
       status = EXCLUDED.status,
       workflow_step = EXCLUDED.workflow_step,
       error_message = EXCLUDED.error_message,
       metadata = app.message_events.metadata || EXCLUDED.metadata`,
    [
      params.externalId,
      params.phone,
      params.direction,
      params.workflowStep,
      params.status,
      params.payloadHash ?? null,
      params.errorMessage ?? null,
      JSON.stringify(params.metadata ?? {}),
    ],
  );
}

export async function recordFailedMessage(
  pool: pg.Pool,
  params: {
    externalId?: string;
    phone: string;
    payload: Record<string, unknown>;
    errorMessage: string;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO app.failed_messages (external_id, phone, payload, error_message)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [
      params.externalId ?? null,
      params.phone,
      JSON.stringify(params.payload),
      params.errorMessage,
    ],
  );
}
