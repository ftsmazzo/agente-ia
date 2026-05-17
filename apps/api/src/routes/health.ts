import type { FastifyInstance } from "fastify";
import { checkDatabase } from "../db/pool.js";
import { checkRedis } from "../redis/client.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_request, reply) => {
    const config = app.config;
    let dbOk = false;
    let redisOk = false;

    try {
      dbOk = await checkDatabase(config.databaseUrl);
    } catch {
      dbOk = false;
    }

    try {
      redisOk = await checkRedis(config.redisUrl);
    } catch {
      redisOk = false;
    }

    const healthy = dbOk && redisOk;
    const payload = {
      status: healthy ? "ok" : "degraded",
      service: "agente-ia-api",
      version: "0.2.0",
      brand_slug: config.brand.brandSlug,
      checks: { database: dbOk, redis: redisOk },
      features: config.features,
      timestamp: new Date().toISOString(),
    };

    return reply.status(healthy ? 200 : 503).send(payload);
  });
}
