import type { ChatTurn } from "../conversation-history.js";

export type LlmProviderId = "openai" | "anthropic";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CompletionRequest = {
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
};

export type LlmProviderConfig = {
  provider: LlmProviderId;
  apiKey: string;
  model: string;
  maxTokens: number;
};

export interface LlmProvider {
  readonly id: LlmProviderId;
  complete(request: CompletionRequest): Promise<string>;
}

export function historyToMessages(history: ChatTurn[]): ChatMessage[] {
  return history.map((t) => ({ role: t.role, content: t.content }));
}
