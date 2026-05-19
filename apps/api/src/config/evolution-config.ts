export type EvolutionSettings = {
  configured: boolean;
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  /** URL do webhook n8n — só exibição no painel */
  webhookUrl: string | null;
};

export function loadEvolutionSettings(): EvolutionSettings {
  const baseUrl =
    process.env.EVOLUTION_BASE_URL?.trim().replace(/\/$/, "") ?? "";
  const apiKey = process.env.EVOLUTION_API_KEY?.trim() ?? "";
  const instanceName = process.env.EVOLUTION_INSTANCE?.trim() ?? "";

  const explicitWebhook = process.env.N8N_WHATSAPP_WEBHOOK_URL?.trim();
  const n8nBase = process.env.N8N_WEBHOOK_BASE_URL?.trim().replace(/\/$/, "");
  const webhookUrl =
    explicitWebhook ||
    (n8nBase ? `${n8nBase}/webhook/whatsapp-agent` : null) ||
    null;

  return {
    configured: Boolean(baseUrl && apiKey && instanceName),
    baseUrl,
    apiKey,
    instanceName,
    webhookUrl,
  };
}
