import type pg from "pg";
import type { Redis } from "ioredis";

function historyKey(phone: string): string {
  return `chat:history:${phone}`;
}

function debounceKeys(phone: string): string[] {
  return [
    `debounce:buf:${phone}`,
    `debounce:gen:${phone}`,
    `debounce:lastAt:${phone}`,
  ];
}

/** Zera histórico Redis + estado Postgres + visitas de um telefone (testes). */
export async function resetConversationForPhone(
  pool: pg.Pool,
  redis: Redis,
  phone: string,
  options?: { cancelAppointments?: boolean },
): Promise<{
  redisKeysDeleted: number;
  appointmentsCancelled: number;
}> {
  const cancelAppointments = options?.cancelAppointments !== false;

  let appointmentsCancelled = 0;
  if (cancelAppointments) {
    const { rowCount } = await pool.query(
      `UPDATE app.appointments
       SET status = 'cancelled', updated_at = NOW()
       WHERE phone = $1 AND status IN ('scheduled', 'confirmed')`,
      [phone],
    );
    appointmentsCancelled = rowCount ?? 0;
  }

  await pool.query(
    `UPDATE app.conversation_state
     SET metadata = COALESCE(metadata, '{}'::jsonb) - 'scheduling',
         mode = 'bot',
         assignee_ref = NULL,
         updated_at = NOW()
     WHERE phone = $1`,
    [phone],
  );

  await pool.query(
    `UPDATE app.lead_actions
     SET metadata = metadata - 'qualification' - 'appointment'
     WHERE phone = $1`,
    [phone],
  );

  const keys = [historyKey(phone), ...debounceKeys(phone)];
  const redisKeysDeleted = keys.length > 0 ? await redis.del(...keys) : 0;

  return { redisKeysDeleted, appointmentsCancelled };
}
