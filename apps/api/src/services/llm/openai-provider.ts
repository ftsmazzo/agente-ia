import type {
  ChatMessage,
  CompletionRequest,
  LlmProvider,
  LlmProviderConfig,
} from "./types.js";
import {
  isOpenAiReasoningModel,
  resolveOpenAiMaxOutputTokens,
} from "./openai-model.js";

function extractResponsesText(data: {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  status?: string;
  incomplete_details?: { reason?: string };
}): string | null {
  const direct = data.output_text?.trim();
  if (direct) return direct;

  for (const item of data.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text?.trim()) {
        return part.text.trim();
      }
    }
  }

  return null;
}

function extractChatCompletionText(data: {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
}): string | null {
  const choice = data.choices?.[0];
  const text = choice?.message?.content?.trim();
  if (text) return text;

  const finish = choice?.finish_reason ?? "unknown";
  if (finish === "length") {
    throw new Error(
      "OpenAI hit max tokens before visible reply (increase LLM_MAX_TOKENS)",
    );
  }

  return null;
}

async function completeWithResponses(
  config: LlmProviderConfig,
  request: CompletionRequest,
): Promise<string> {
  const maxOutput = resolveOpenAiMaxOutputTokens(
    config.model,
    request.maxTokens,
  );

  const input = request.messages.map((m: ChatMessage) => ({
    role: m.role,
    content: m.content,
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      input,
      max_output_tokens: maxOutput,
      reasoning: { effort: "low" },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI Responses ${response.status}: ${raw.slice(0, 400)}`);
  }

  const data = JSON.parse(raw) as Parameters<typeof extractResponsesText>[0];
  const text = extractResponsesText(data);
  if (text) return text;

  if (data.status === "incomplete") {
    const why = data.incomplete_details?.reason ?? "unknown";
    throw new Error(
      `OpenAI incomplete (${why}) — increase LLM_MAX_TOKENS (current effective min ${maxOutput})`,
    );
  }

  throw new Error("OpenAI Responses returned empty output");
}

async function completeWithChatCompletions(
  config: LlmProviderConfig,
  request: CompletionRequest,
): Promise<string> {
  const maxOutput = resolveOpenAiMaxOutputTokens(
    config.model,
    request.maxTokens,
  );

  const payload: Record<string, unknown> = {
    model: config.model,
    messages: request.messages,
  };

  if (isOpenAiReasoningModel(config.model)) {
    payload.max_completion_tokens = maxOutput;
  } else {
    payload.max_tokens = maxOutput;
    payload.temperature = request.temperature ?? 0.7;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI Chat ${response.status}: ${raw.slice(0, 400)}`);
  }

  const data = JSON.parse(raw) as Parameters<typeof extractChatCompletionText>[0];
  const text = extractChatCompletionText(data);
  if (text) return text;

  throw new Error("OpenAI Chat returned empty content");
}

export function createOpenAiProvider(config: LlmProviderConfig): LlmProvider {
  return {
    id: "openai",
    async complete(request: CompletionRequest): Promise<string> {
      if (isOpenAiReasoningModel(config.model)) {
        try {
          return await completeWithResponses(config, request);
        } catch (responsesErr) {
          const msg =
            responsesErr instanceof Error
              ? responsesErr.message
              : String(responsesErr);
          try {
            return await completeWithChatCompletions(config, request);
          } catch (chatErr) {
            const chatMsg =
              chatErr instanceof Error ? chatErr.message : String(chatErr);
            throw new Error(
              `OpenAI failed (responses: ${msg}; chat: ${chatMsg})`,
            );
          }
        }
      }

      return completeWithChatCompletions(config, request);
    },
  };
}
