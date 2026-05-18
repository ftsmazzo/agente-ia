import type { FastifyInstance } from "fastify";
import { checkDatabase, getPool } from "../db/pool.js";
import { checkRedis } from "../redis/client.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_request, reply) => {
    const config = app.config;
    let dbOk = false;
    let redisOk = false;
    let failedMessagesUnresolved = 0;

    const warnings: string[] = [];

    if (process.env.RESET_DEV_DATA_ON_START === "true") {
      warnings.push(
        "RESET_DEV_DATA_ON_START=true apaga Postgres/Redis a cada restart — desligue em produção",
      );
    }

    const debounceMs = Number(process.env.DEBOUNCE_MS ?? 3000);
    if (!Number.isFinite(debounceMs) || debounceMs < 500) {
      warnings.push("DEBOUNCE_MS inválido — usando 3000ms no endpoint de debounce");
    }

    try {
      dbOk = await checkDatabase(config.databaseUrl);
      if (dbOk) {
        const row = await getPool(config.databaseUrl).query<{
          count: string;
        }>(
          `SELECT COUNT(*)::text AS count FROM app.failed_messages WHERE resolved_at IS NULL`,
        );
        failedMessagesUnresolved = Number(row.rows[0]?.count ?? 0);
        if (failedMessagesUnresolved > 0) {
          warnings.push(
            `${failedMessagesUnresolved} mensagem(ns) em app.failed_messages sem resolver`,
          );
        }
      }
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
      version: process.env.APP_VERSION ?? "0.5.0",
      brand_slug: config.brand.brandSlug,
      assistant_name: config.brand.assistantName,
      llm: {
        enabled: config.llm.enabled,
        provider: config.llm.provider,
        model: config.llm.model,
        maxTokens: config.llm.maxTokens,
      },
      rag: {
        enabled: config.rag.enabled,
        knowledgeBaseId: config.rag.enabled
          ? config.rag.knowledgeBaseId
          : null,
        topK: config.rag.topK,
        baseUrl: config.rag.baseUrl,
      },
      debounce: {
        defaultMs: Number.isFinite(debounceMs) && debounceMs > 0 ? debounceMs : 3000,
        endpoint: "/v1/debounce/wait-and-merge",
      },
      ops: {
        failed_messages_unresolved: failedMessagesUnresolved,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
      checks: { database: dbOk, redis: redisOk },
      features: config.features,
      timestamp: new Date().toISOString(),
    };

    return reply.status(healthy ? 200 : 503).send(payload);
  });
}
