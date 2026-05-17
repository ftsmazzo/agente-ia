import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config/app-config.js";
import { retryAsync } from "../lib/retry.js";
import { getPool, checkDatabase, closePool } from "../db/pool.js";
import { getRedis, checkRedis, closeRedis } from "../redis/client.js";

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    db: ReturnType<typeof getPool>;
    redis: ReturnType<typeof getRedis>;
  }
}

export async function registerInfra(
  app: FastifyInstance,
  config: AppConfig,
): Promise<void> {
  app.decorate("config", config);
  app.decorate("db", getPool(config.databaseUrl));
  app.decorate("redis", getRedis(config.redisUrl));

  if (app.redis.status !== "ready") {
    await app.redis.connect();
  }

  app.addHook("onClose", async () => {
    await closeRedis();
    await closePool();
  });
}

export async function verifyInfra(config: AppConfig): Promise<void> {
  await retryAsync(
    async () => {
      const ok = await checkDatabase(config.databaseUrl);
      if (!ok) throw new Error("PostgreSQL not ready");
    },
    { label: "postgresql", attempts: 10, delayMs: 2000 },
  );

  await retryAsync(
    async () => {
      const ok = await checkRedis(config.redisUrl);
      if (!ok) throw new Error("Redis not ready");
    },
    { label: "redis", attempts: 10, delayMs: 2000 },
  );
}
