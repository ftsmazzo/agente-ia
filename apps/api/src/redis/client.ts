import { Redis } from "ioredis";

let redis: Redis | null = null;

export function getRedis(redisUrl: string): Redis {
  if (!redis) {
    if (!redisUrl) {
      throw new Error("REDIS_URL is required");
    }
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}

export async function checkRedis(redisUrl: string): Promise<boolean> {
  const client = getRedis(redisUrl);
  if (client.status !== "ready") {
    await client.connect();
  }
  const pong = await client.ping();
  return pong === "PONG";
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
