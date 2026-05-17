import type {
  CompletionRequest,
  LlmProvider,
  LlmProviderConfig,
} from "./types.js";

export function createOpenAiProvider(config: LlmProviderConfig): LlmProvider {
  return {
    id: "openai",
    async complete(request: CompletionRequest): Promise<string> {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages: request.messages,
          max_tokens: request.maxTokens,
          temperature: request.temperature ?? 0.7,
        }),
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
