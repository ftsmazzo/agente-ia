import type { Redis } from "ioredis";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

function historyKey(phone: string): string {
  return `chat:history:${phone}`;
}

export async function loadHistory(
  redis: Redis,
  phone: string,
  maxTurns: number,
): Promise<ChatTurn[]> {
  const raw = await redis.get(historyKey(phone));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ChatTurn[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-maxTurns * 2);
  } catch {
    return [];
  }
}

export async function appendHistory(
  redis: Redis,
  phone: string,
  userMessage: string,
  assistantMessage: string,
  maxTurns: number,
): Promise<void> {
  const current = await loadHistory(redis, phone, maxTurns);
  const next: ChatTurn[] = [
    ...current,
    { role: "user" as const, content: userMessage },
    { role: "assistant" as const, content: assistantMessage },
  ].slice(-maxTurns * 2);

  await redis.set(historyKey(phone), JSON.stringify(next), "EX", TTL_SECONDS);
}
