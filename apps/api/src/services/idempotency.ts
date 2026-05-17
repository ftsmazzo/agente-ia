import type { Redis } from "ioredis";

const TTL_SECONDS = 86_400; // 24h

export async function claimMessage(
  redis: Redis,
  messageId: string,
): Promise<boolean> {
  const key = `idem:${messageId}`;
  const result = await redis.set(key, "1", "EX", TTL_SECONDS, "NX");
  return result === "OK";
}
