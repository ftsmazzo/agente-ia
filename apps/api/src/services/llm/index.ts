import type { LlmProvider, LlmProviderConfig, LlmProviderId } from "./types.js";
import { createOpenAiProvider } from "./openai-provider.js";
import { createAnthropicProvider } from "./anthropic-provider.js";

export type { LlmProvider, LlmProviderConfig, LlmProviderId, ChatMessage } from "./types.js";
export { historyToMessages } from "./types.js";

export function createLlmProvider(config: LlmProviderConfig): LlmProvider {
  switch (config.provider) {
    case "anthropic":
      return createAnthropicProvider(config);
    case "openai":
    default:
      return createOpenAiProvider(config);
  }
}
