export type RagSettings = {
  /** RAG ativo (feature flag + API key + knowledge base id) */
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  knowledgeBaseId: string;
  topK: number;
  timeoutMs: number;
};

export function loadRagSettings(
  propertyRagFeature: boolean,
): RagSettings {
  const baseUrl = (process.env.RAG_API_URL ?? "").trim().replace(/\/$/, "");
  const apiKey = process.env.RAG_API_KEY?.trim() ?? "";
  const knowledgeBaseId =
    process.env.RAG_KNOWLEDGE_BASE_ID?.trim() ??
    process.env.RAG_KB_ID?.trim() ??
    "";

  const topK = Number(process.env.RAG_TOP_K ?? 5);
  const timeoutMs = Number(process.env.RAG_TIMEOUT_MS ?? 15_000);

  const enabled =
    propertyRagFeature && Boolean(apiKey && knowledgeBaseId && baseUrl);

  return {
    enabled,
    baseUrl,
    apiKey,
    knowledgeBaseId,
    topK: Number.isFinite(topK) && topK > 0 ? Math.min(topK, 10) : 3,
    timeoutMs:
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000,
  };
}
