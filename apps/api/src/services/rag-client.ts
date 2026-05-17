export type RagQueryResult = {
  answer: string | null;
  sources: Array<{
    documentId?: number;
    filename?: string;
    content: string;
    similarity?: number;
  }>;
  processingTime?: number;
};

type RagQueryResponse = {
  success?: boolean;
  data?: {
    answer?: string;
    sources?: Array<{
      documentId?: number;
      filename?: string;
      content?: string;
      similarity?: number;
    }>;
    processingTime?: number;
  };
  message?: string;
};

export async function queryKnowledgeBase(params: {
  baseUrl: string;
  apiKey: string;
  knowledgeBaseId: string;
  query: string;
  topK: number;
  timeoutMs: number;
}): Promise<RagQueryResult> {
  const url = `${params.baseUrl}/api/kb/${encodeURIComponent(params.knowledgeBaseId)}/query`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: params.query,
        topK: params.topK,
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(
        `RAG ${response.status}: ${raw.slice(0, 400) || response.statusText}`,
      );
    }

    let parsed: RagQueryResponse;
    try {
      parsed = JSON.parse(raw) as RagQueryResponse;
    } catch {
      throw new Error("RAG returned invalid JSON");
    }

    if (parsed.success === false) {
      throw new Error(parsed.message ?? "RAG query failed");
    }

    const sources = (parsed.data?.sources ?? [])
      .map((s) => ({
        documentId: s.documentId,
        filename: s.filename,
        content: (s.content ?? "").trim(),
        similarity: s.similarity,
      }))
      .filter((s) => s.content.length > 0);

    return {
      answer: parsed.data?.answer?.trim() || null,
      sources,
      processingTime: parsed.data?.processingTime,
    };
  } finally {
    clearTimeout(timer);
  }
}
