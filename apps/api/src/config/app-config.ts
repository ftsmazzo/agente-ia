import {
  loadBrandConfigFromEnv,
  loadFeatureFlagsFromEnv,
  type BrandConfig,
  type FeatureFlags,
} from "@realty/shared";
import type { LlmProviderId } from "../services/llm/types.js";

export type LlmSettings = {
  enabled: boolean;
  provider: LlmProviderId;
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
  personaPromptPath: string;
  databaseUrl: string;
  redisUrl: string;
  brand: BrandConfig;
  features: FeatureFlags;
  llm: LlmSettings;
};

function resolveLlmProvider(): LlmProviderId {
  const raw = (process.env.LLM_PROVIDER ?? "openai").trim().toLowerCase();
  if (raw === "anthropic" || raw === "claude") return "anthropic";
  return "openai";
}

function loadLlmSettings(): LlmSettings {
  const provider = resolveLlmProvider();
  const openaiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim() ?? "";

  const apiKey = provider === "anthropic" ? anthropicKey : openaiKey;
  const defaultModel =
    provider === "anthropic"
      ? process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-20241022"
      : process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const model =
    process.env.LLM_MODEL?.trim() ||
    (provider === "anthropic"
      ? process.env.ANTHROPIC_MODEL?.trim()
      : process.env.OPENAI_MODEL?.trim()) ||
    defaultModel;

  return {
    enabled: Boolean(apiKey),
    provider,
    apiKey,
    model,
    maxTokens: Number(process.env.LLM_MAX_TOKENS ?? process.env.OPENAI_MAX_TOKENS ?? 600),
    maxHistoryTurns: Number(process.env.CHAT_MAX_HISTORY_TURNS ?? 8),
  };
}

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

  return {
    port,
    nodeEnv: process.env.NODE_ENV ?? "development",
    logLevel: process.env.LOG_LEVEL ?? "info",
    apiInternalKey: apiInternalKey ?? "dev-only-key",
    systemPromptPath:
      process.env.SYSTEM_PROMPT_PATH ?? "/app/config/prompts/system.pt-BR.md",
    personaPromptPath:
      process.env.PERSONA_PROMPT_PATH ??
      "/app/config/prompts/persona.pt-BR.md",
    databaseUrl,
    redisUrl,
    brand: loadBrandConfigFromEnv(),
    features: loadFeatureFlagsFromEnv(),
    llm: loadLlmSettings(),
  };
}
