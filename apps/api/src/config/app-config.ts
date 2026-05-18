import {
  loadBrandConfigFromEnv,
  loadFeatureFlagsFromEnv,
  type BrandConfig,
  type FeatureFlags,
} from "@realty/shared";
import type { LlmProviderId } from "../services/llm/types.js";
import { resolveOpenAiMaxOutputTokens } from "../services/llm/openai-model.js";
import { loadRagSettings, type RagSettings } from "./rag-config.js";

export type LlmSettings = {
  enabled: boolean;
  provider: LlmProviderId;
  apiKey: string;
  model: string;
  maxTokens: number;
  maxHistoryTurns: number;
};

export type PortalAuthConfig = {
  jwtSecret: string;
  corsOrigin: string | null;
  bootstrapSecret: string | null;
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
  rag: RagSettings;
  portal: PortalAuthConfig;
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

  const requestedMax = Number(
    process.env.LLM_MAX_TOKENS ?? process.env.OPENAI_MAX_TOKENS ?? 0,
  );
  const defaultMax = provider === "openai" ? 600 : 600;
  const maxTokens =
    provider === "openai"
      ? resolveOpenAiMaxOutputTokens(
          model,
          requestedMax > 0 ? requestedMax : defaultMax,
        )
      : requestedMax > 0
        ? requestedMax
        : defaultMax;

  return {
    enabled: Boolean(apiKey),
    provider,
    apiKey,
    model,
    maxTokens,
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
  const features = loadFeatureFlagsFromEnv();
  const rag = loadRagSettings(features.propertyRag);

  if (process.env.NODE_ENV === "production") {
    if (!databaseUrl) throw new Error("DATABASE_URL is required in production");
    if (!redisUrl) throw new Error("REDIS_URL is required in production");
  }

  const portalJwtSecret =
    process.env.PORTAL_JWT_SECRET?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "dev-portal-jwt-secret");
  if (process.env.NODE_ENV === "production" && !portalJwtSecret) {
    throw new Error("PORTAL_JWT_SECRET is required in production");
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
    features,
    llm: loadLlmSettings(),
    rag,
    portal: {
      jwtSecret: portalJwtSecret || "dev-portal-jwt-secret",
      corsOrigin: process.env.PORTAL_CORS_ORIGIN?.trim() || null,
      bootstrapSecret: process.env.PORTAL_BOOTSTRAP_SECRET?.trim() || null,
    },
  };
}
