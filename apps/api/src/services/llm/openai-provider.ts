import type {
  CompletionRequest,
  LlmProvider,
  LlmProviderConfig,
} from "./types.js";

/** GPT-5+ e modelos de raciocínio não aceitam `max_tokens` na Chat Completions API. */
function usesMaxCompletionTokens(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.startsWith("gpt-5") ||
    m.startsWith("o1") ||
    m.startsWith("o3") ||
    m.startsWith("o4")
  );
}

export function createOpenAiProvider(config: LlmProviderConfig): LlmProvider {
  return {
    id: "openai",
    async complete(request: CompletionRequest): Promise<string> {
      const payload: Record<string, unknown> = {
        model: config.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
      };

      if (usesMaxCompletionTokens(config.model)) {
        payload.max_completion_tokens = request.maxTokens;
      } else {
        payload.max_tokens = request.maxTokens;
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI ${response.status}: ${errText.slice(0, 300)}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("OpenAI returned empty content");
      return text;
    },
  };
}
