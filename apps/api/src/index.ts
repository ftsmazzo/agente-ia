import Fastify from "fastify";
import { loadAppConfig } from "./config/app-config.js";
import { registerInternalAuth } from "./plugins/auth-internal.js";
import { registerInfra, verifyInfra } from "./plugins/infra.js";
import { healthRoutes } from "./routes/health.js";
import { chatRoutes } from "./routes/v1/chat.js";
import { conversationRoutes } from "./routes/v1/conversation.js";
import { debounceRoutes } from "./routes/v1/debounce.js";
import { configRoutes } from "./routes/v1/config.js";
import { schedulingRoutes } from "./routes/v1/scheduling.js";

async function main(): Promise<void> {
  const config = loadAppConfig();

  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        config.nodeEnv === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  await registerInfra(app, config);
  await verifyInfra(config);

  await registerInternalAuth(app, config.apiInternalKey);
  await healthRoutes(app);
  await configRoutes(app);
  await chatRoutes(app);
  await conversationRoutes(app);
  await debounceRoutes(app);
  await schedulingRoutes(app);

  await app.listen({ port: config.port, host: "0.0.0.0" });

  app.log.info(
    {
      brand_slug: config.brand.brandSlug,
      brand_name: config.brand.brandName,
      port: config.port,
    },
    "agente-ia-api started",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
