import {
  loadBrandConfigFromEnv,
  loadFeatureFlagsFromEnv,
  type BrandConfig,
  type FeatureFlags,
} from "@realty/shared";

export type LlmSettings = {
  enabled: boolean;
  apiKey: string;
  model: string;
  maxTokens: number;
  maxHistoryTurns: number;
};

export type AppConfig = {
  port: number;
  nodeEnv: string;
  logLevel: string;
  apiInternalKey: string;
  systemPromptPath: string;
  databaseUrl: string;
  redisUrl: string;
  brand: BrandConfig;
  features: FeatureFlags;
  llm: LlmSettings;
};

export function loadAppConfig(): AppConfig {
  const port = Number(process.env.PORT ?? 3000);
  const apiInternalKey = process.env.API_INTERNAL_KEY?.trim();

  if (!apiInternalKey || apiInternalKey === "change-me-in-production") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("API_INTERNAL_KEY must be set to a strong secret in production");
    }
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  const redisUrl = process.env.REDIS_URL?.trim() ?? "";

  if (process.env.NODE_ENV === "production") {
    if (!databaseUrl) throw new Error("DATABASE_URL is required in production");
    if (!redisUrl) throw new Error("REDIS_URL is required in production");
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? "";

  return {
    port,
    nodeEnv: process.env.NODE_ENV ?? "development",
    logLevel: process.env.LOG_LEVEL ?? "info",
    apiInternalKey: apiInternalKey ?? "dev-only-key",
    systemPromptPath:
      process.env.SYSTEM_PROMPT_PATH ?? "/app/config/prompts/system.pt-BR.md",
    databaseUrl: process.env.DATABASE_URL ?? "",
    redisUrl: process.env.REDIS_URL ?? "",
    brand: loadBrandConfigFromEnv(),
    features: loadFeatureFlagsFromEnv(),
    llm: {
      enabled: Boolean(openaiKey),
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      maxTokens: Number(process.env.OPENAI_MAX_TOKENS ?? 500),
      maxHistoryTurns: Number(process.env.CHAT_MAX_HISTORY_TURNS ?? 8),
    },
  };
}
