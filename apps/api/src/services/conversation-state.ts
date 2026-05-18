import type pg from "pg";

export type ConversationMode = "bot" | "human" | "paused";

export async function getConversationMode(
  pool: pg.Pool,
  phone: string,
): Promise<ConversationMode> {
  const { rows } = await pool.query<{ mode: ConversationMode }>(
    `SELECT mode FROM app.conversation_state WHERE phone = $1`,
    [phone],
  );
  return rows[0]?.mode ?? "bot";
}

export async function touchConversation(
  pool: pg.Pool,
  phone: string,
  mode: ConversationMode = "bot",
): Promise<void> {
  await pool.query(
    `INSERT INTO app.conversation_state (phone, mode, last_message_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (phone) DO UPDATE SET
       last_message_at = NOW(),
       updated_at = NOW()`,
    [phone, mode],
  );
}

export type ConversationStateRow = {
  phone: string;
  mode: ConversationMode;
  assignee_ref: string | null;
  last_message_at: Date | null;
  metadata: Record<string, unknown>;
};

export async function getConversationState(
  pool: pg.Pool,
  phone: string,
): Promise<ConversationStateRow | null> {
  const { rows } = await pool.query<{
    phone: string;
    mode: ConversationMode;
    assignee_ref: string | null;
    last_message_at: Date | null;
    metadata: Record<string, unknown>;
  }>(
    `SELECT phone, mode, assignee_ref, last_message_at, metadata
     FROM app.conversation_state WHERE phone = $1`,
    [phone],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    phone: row.phone,
    mode: row.mode,
    assignee_ref: row.assignee_ref,
    last_message_at: row.last_message_at,
    metadata: row.metadata ?? {},
  };
}

export async function setConversationMode(
  pool: pg.Pool,
  phone: string,
  mode: ConversationMode,
  options?: {
    assigneeRef?: string | null;
    metadataPatch?: Record<string, unknown>;
    reason?: string;
  },
): Promise<void> {
  const metaPatch = {
    ...(options?.metadataPatch ?? {}),
    ...(options?.reason ? { last_mode_reason: options.reason } : {}),
    mode_changed_at: new Date().toISOString(),
  };

  await pool.query(
    `INSERT INTO app.conversation_state (
       phone, mode, assignee_ref, last_message_at, metadata, updated_at
     )
     VALUES ($1, $2, $3, NOW(), $4::jsonb, NOW())
     ON CONFLICT (phone) DO UPDATE SET
       mode = EXCLUDED.mode,
       assignee_ref = COALESCE(EXCLUDED.assignee_ref, app.conversation_state.assignee_ref),
       last_message_at = NOW(),
       metadata = app.conversation_state.metadata || EXCLUDED.metadata,
       updated_at = NOW()`,
    [
      phone,
      mode,
      options?.assigneeRef ?? null,
      JSON.stringify(metaPatch),
    ],
  );
}
