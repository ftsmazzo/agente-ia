import { z } from "zod";

/**
 * White-label brand configuration — loaded from deployment environment.
 * No client-specific names belong in source code; only placeholders here.
 */
export const brandConfigSchema = z.object({
  brandName: z.string().min(2).max(120),
  brandSlug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "brandSlug must be kebab-case"),
  assistantName: z.string().min(1).max(64),
  assistantTitle: z.string().min(1).max(120),
  brandWebsite: z.string().url().optional().or(z.literal("")),
  brandPrimaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  brandLogoUrl: z.string().url().optional().or(z.literal("")),
  defaultLocale: z.string().default("pt-BR"),
  timezone: z.string().default("America/Sao_Paulo"),
});

export type BrandConfig = z.infer<typeof brandConfigSchema>;

export const featureFlagsSchema = z.object({
  audioReply: z.boolean().default(true),
  scheduling: z.boolean().default(true),
  propertyRag: z.boolean().default(true),
  humanHandoff: z.boolean().default(true),
});

export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

/** Template variables available in system prompts and outbound messages */
export type BrandTemplateContext = {
  brand_name: string;
  brand_slug: string;
  assistant_name: string;
  assistant_title: string;
  brand_website: string;
};

export function toBrandTemplateContext(brand: BrandConfig): BrandTemplateContext {
  return {
    brand_name: brand.brandName,
    brand_slug: brand.brandSlug,
    assistant_name: brand.assistantName,
    assistant_title: brand.assistantTitle,
    brand_website: brand.brandWebsite ?? "",
  };
}

/**
 * Replace {{key}} placeholders in templates (prompts, messages).
 * Keys must match BrandTemplateContext.
 */
export function renderTemplate(
  template: string,
  context: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key: string) => {
    return context[key] ?? "";
  });
}
