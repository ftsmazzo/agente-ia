import type { FastifyInstance } from "fastify";

export async function configRoutes(app: FastifyInstance): Promise<void> {
  const config = app.config;

  app.get("/v1/config/brand", async () => ({
    brand: {
      name: config.brand.brandName,
      slug: config.brand.brandSlug,
      assistantName: config.brand.assistantName,
      assistantTitle: config.brand.assistantTitle,
      website: config.brand.brandWebsite ?? null,
      locale: config.brand.defaultLocale,
      timezone: config.brand.timezone,
    },
    features: config.features,
  }));
}
