import {
  brandConfigSchema,
  featureFlagsSchema,
  type BrandConfig,
  type FeatureFlags,
} from "./brand.js";

function envBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function envString(key: string, required = true): string {
  const value = process.env[key]?.trim();
  if (!value && required) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value ?? "";
}

/**
 * Parse brand + feature flags from process.env.
 * Used by API at startup — fails fast if misconfigured.
 */
export function loadBrandConfigFromEnv(): BrandConfig {
  return brandConfigSchema.parse({
    brandName: envString("BRAND_NAME"),
    brandSlug: envString("BRAND_SLUG"),
    assistantName: envString("ASSISTANT_NAME"),
    assistantTitle: envString("ASSISTANT_TITLE"),
    brandWebsite: process.env.BRAND_WEBSITE?.trim() || undefined,
    brandPrimaryColor: process.env.BRAND_PRIMARY_COLOR?.trim() || undefined,
    brandLogoUrl: process.env.BRAND_LOGO_URL?.trim() || undefined,
    defaultLocale: process.env.DEFAULT_LOCALE?.trim() || "pt-BR",
    timezone: process.env.TIMEZONE?.trim() || "America/Sao_Paulo",
  });
}

export function loadFeatureFlagsFromEnv(): FeatureFlags {
  return featureFlagsSchema.parse({
    audioReply: envBool(process.env.FEATURE_AUDIO_REPLY, true),
    scheduling: envBool(process.env.FEATURE_SCHEDULING, true),
    propertyRag: envBool(process.env.FEATURE_PROPERTY_RAG, true),
    humanHandoff: envBool(process.env.FEATURE_HUMAN_HANDOFF, true),
  });
}
