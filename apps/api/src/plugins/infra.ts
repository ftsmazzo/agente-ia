import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config/app-config.js";
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
  const [dbOk, redisOk] = await Promise.all([
    checkDatabase(config.databaseUrl),
    checkRedis(config.redisUrl),
  ]);
  if (!dbOk) throw new Error("PostgreSQL health check failed");
  if (!redisOk) throw new Error("Redis health check failed");
}
