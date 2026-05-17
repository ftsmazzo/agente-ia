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
