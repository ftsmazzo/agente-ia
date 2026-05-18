#!/usr/bin/env node
/**
 * Zera Postgres (conversas/leads/eventos) e Redis (histórico + idempotência).
 * Só roda com RESET_DEV_DATA_ON_START=true e fora de produção
 * (ou com ALLOW_DEV_DATA_RESET=true explícito).
 */
const databaseUrl = process.env.DATABASE_URL?.trim();
const redisUrl = process.env.REDIS_URL?.trim();

const invokedDirectly = process.argv.includes("--run");

if (process.env.RESET_DEV_DATA_ON_START !== "true" && !invokedDirectly) {
  console.log(
    "[reset-dev] ignorado (use RESET_DEV_DATA_ON_START=true no deploy ou npm run db:reset-dev)",
  );
  process.exit(0);
}

const nodeEnv = (process.env.NODE_ENV ?? "development").toLowerCase();
const allowInProd = process.env.ALLOW_DEV_DATA_RESET === "true";

if (nodeEnv === "production" && !allowInProd) {
  console.error(
    "[reset-dev] IGNORADO: NODE_ENV=production sem ALLOW_DEV_DATA_RESET=true.",
  );
  console.error(
    "[reset-dev] Para zerar dados em produção de teste, adicione ALLOW_DEV_DATA_RESET=true e reinicie o container.",
  );
  console.error(
    "[reset-dev] Ou use POST /v1/conversation/reset para um telefone (ver docs).",
  );
  process.exit(0);
}

if (!databaseUrl) {
  console.error("[reset-dev] DATABASE_URL is required");
  process.exit(1);
}

console.warn(
  "[reset-dev] ATENÇÃO: apagando dados de conversa, leads, eventos e cache Redis…",
);

const pg = await import("pg");

const client = new pg.default.Client({ connectionString: databaseUrl });
try {
  await client.connect();
  await client.query(`
    TRUNCATE TABLE
      app.appointments,
      app.portal_users,
      app.properties,
      app.failed_messages,
      app.lead_actions,
      app.message_events,
      app.conversation_state,
      app.contacts,
      app.prompt_versions
    RESTART IDENTITY CASCADE
  `);
  console.log(
    "[reset-dev] PostgreSQL: appointments, conversas, leads e eventos apagados (appointment_settings e schema_migrations mantidos)",
  );
} finally {
  await client.end().catch(() => undefined);
}

if (redisUrl) {
  const { default: Redis } = await import("ioredis");
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true });
  try {
    await redis.connect();
    const dbIndex = redis.options.db ?? 0;
    await redis.flushdb();
    console.log(`[reset-dev] Redis: FLUSHDB no database ${dbIndex} (histórico chat:* e idem:*)`);
  } finally {
    await redis.quit().catch(() => undefined);
  }
} else {
  console.log("[reset-dev] REDIS_URL ausente — pulando flush Redis");
}

console.log("[reset-dev] concluído. Desative RESET_DEV_DATA_ON_START após validar o deploy.");
