import type pg from "pg";
import type { Redis } from "ioredis";
import { loadHistory, type ChatTurn } from "./conversation-history.js";

export type ConversationSummary = {
  phone: string;
  displayName: string | null;
  mode: "bot" | "human" | "paused";
  lastMessageAt: string | null;
  preview: string | null;
};

export type ConversationEvent = {
  id: number;
  direction: "inbound" | "outbound";
  status: string;
  workflowStep: string;
  text: string | null;
  reason: string | null;
  createdAt: string;
};

function previewFromMetadata(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const text = metadata.text;
  if (typeof text === "string" && text.trim()) return text.trim().slice(0, 160);
  const reason = metadata.reason;
  if (typeof reason === "string") return `[${reason}]`;
  return null;
}

export async function listConversations(
  pool: pg.Pool,
  options?: { limit?: number; offset?: number; search?: string },
): Promise<{ items: ConversationSummary[]; total: number }> {
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);
  const search = options?.search?.trim().replace(/\D/g, "") || options?.search?.trim() || "";

  const searchDigits = search.replace(/\D/g, "");
  const hasSearch = search.length > 0;

  const countRes = await pool.query<{ count: string }>(
    `WITH phones AS (
       SELECT phone FROM app.conversation_state
       UNION
       SELECT DISTINCT phone FROM app.message_events WHERE phone <> ''
     )
     SELECT COUNT(*)::text AS count
     FROM phones p
     LEFT JOIN app.contacts c ON c.phone = p.phone
     WHERE ($1::boolean = FALSE OR p.phone LIKE '%' || $2 || '%' OR c.display_name ILIKE '%' || $3 || '%')`,
    [hasSearch, searchDigits || search, search],
  );
  const total = Number(countRes.rows[0]?.count ?? 0);

  const { rows } = await pool.query<{
    phone: string;
    display_name: string | null;
    mode: "bot" | "human" | "paused";
    last_message_at: Date | null;
    preview_meta: Record<string, unknown> | null;
  }>(
    `WITH phones AS (
       SELECT phone FROM app.conversation_state
       UNION
       SELECT DISTINCT phone FROM app.message_events WHERE phone <> ''
     )
     SELECT
       p.phone,
       c.display_name,
       COALESCE(cs.mode, 'bot') AS mode,
       COALESCE(cs.last_message_at, (
         SELECT MAX(me.created_at) FROM app.message_events me WHERE me.phone = p.phone
       )) AS last_message_at,
       (
         SELECT me.metadata
         FROM app.message_events me
         WHERE me.phone = p.phone
         ORDER BY me.created_at DESC
         LIMIT 1
       ) AS preview_meta
     FROM phones p
     LEFT JOIN app.contacts c ON c.phone = p.phone
     LEFT JOIN app.conversation_state cs ON cs.phone = p.phone
     WHERE ($1::boolean = FALSE OR p.phone LIKE '%' || $2 || '%' OR c.display_name ILIKE '%' || $3 || '%')
     ORDER BY last_message_at DESC NULLS LAST, p.phone
     LIMIT $4 OFFSET $5`,
    [hasSearch, searchDigits || search, search, limit, offset],
  );

  return {
    total,
    items: rows.map((r) => ({
      phone: r.phone,
      displayName: r.display_name,
      mode: r.mode,
      lastMessageAt: r.last_message_at?.toISOString() ?? null,
      preview: previewFromMetadata(r.preview_meta),
    })),
  };
}

export async function getConversationThread(
  pool: pg.Pool,
  redis: Redis | null,
  phone: string,
  options?: { limit?: number; includeRedis?: boolean },
): Promise<{
  phone: string;
  displayName: string | null;
  mode: "bot" | "human" | "paused";
  events: ConversationEvent[];
  redisHistory: ChatTurn[];
}> {
  const normalized = phone.replace(/\D/g, "");
  const limit = Math.min(Math.max(options?.limit ?? 200, 1), 500);

  const [contactRes, stateRes, eventsRes] = await Promise.all([
    pool.query<{ display_name: string | null }>(
      `SELECT display_name FROM app.contacts WHERE phone = $1`,
      [normalized],
    ),
    pool.query<{ mode: "bot" | "human" | "paused" }>(
      `SELECT mode FROM app.conversation_state WHERE phone = $1`,
      [normalized],
    ),
    pool.query<{
      id: number;
      direction: "inbound" | "outbound";
      status: string;
      workflow_step: string;
      metadata: Record<string, unknown>;
      created_at: Date;
    }>(
      `SELECT id, direction, status, workflow_step, metadata, created_at
       FROM app.message_events
       WHERE phone = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [normalized, limit],
    ),
  ]);

  const events: ConversationEvent[] = eventsRes.rows.map((r) => {
    const meta = r.metadata ?? {};
    const text =
      typeof meta.text === "string" ? meta.text : null;
    const reason =
      typeof meta.reason === "string" ? meta.reason : null;
    return {
      id: r.id,
      direction: r.direction,
      status: r.status,
      workflowStep: r.workflow_step,
      text,
      reason,
      createdAt: r.created_at.toISOString(),
    };
  });

  let redisHistory: ChatTurn[] = [];
  if (redis && options?.includeRedis !== false) {
    redisHistory = await loadHistory(redis, normalized, 30);
  }

  return {
    phone: normalized,
    displayName: contactRes.rows[0]?.display_name ?? null,
    mode: stateRes.rows[0]?.mode ?? "bot",
    events,
    redisHistory,
  };
}
