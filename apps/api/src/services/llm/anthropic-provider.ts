import type {
  CompletionRequest,
  LlmProvider,
  LlmProviderConfig,
} from "./types.js";

export function createAnthropicProvider(config: LlmProviderConfig): LlmProvider {
  return {
    id: "anthropic",
    async complete(request: CompletionRequest): Promise<string> {
      const systemParts = request.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content);
      const system = systemParts.join("\n\n");
      const messages = request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: request.maxTokens,
          temperature: request.temperature ?? 0.7,
          system: system || undefined,
          messages,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `Anthropic ${response.status}: ${errText.slice(0, 300)}`,
        );
      }

      const data = (await response.json()) as {
        content?: Array<{ type?: string; text?: string }>;
      };

      const text = data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("")
        .trim();

      if (!text) throw new Error("Anthropic returned empty content");
      return text;
    },
  };
}
