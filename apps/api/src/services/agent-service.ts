import type { BrandConfig } from "@realty/shared";
import type { ChatTurn } from "./conversation-history.js";

export type AgentContext = {
  contactName: string | null;
  propertyCode: string | null;
  hasPropertyInterest: boolean;
};

export type LlmConfig = {
  apiKey: string;
  model: string;
  maxTokens: number;
};

function buildRuntimeContext(
  brand: BrandConfig,
  ctx: AgentContext,
): string {
  const lines = [
    "## Contexto desta conversa (sistema)",
    `- Telefone do cliente: registrado`,
    `- Nome conhecido: ${ctx.contactName ?? "ainda não informado"}`,
  ];

  if (ctx.propertyCode) {
    lines.push(`- Código de imóvel mencionado agora: ${ctx.propertyCode}`);
    lines.push(
      "- Você ainda NÃO tem ficha técnica deste imóvel nesta fase. Não invente preço, metragem ou disponibilidade.",
    );
    lines.push(
      "- Confirme o interesse, faça 1–2 perguntas de qualificação (ex.: compra/aluguel, região, urgência) e ofereça encaminhar a um corretor.",
    );
  } else if (ctx.hasPropertyInterest) {
    lines.push("- Cliente demonstrou interesse em imóvel sem código específico.");
    lines.push("- Peça o código do anúncio (formato AP1234) ou o link, de forma natural.");
  }

  lines.push(
    `- Você representa ${brand.brandName}. Assistente: ${brand.assistantName}.`,
  );
  lines.push("- Responda em português do Brasil, mensagem curta para WhatsApp (máx. ~3 parágrafos breves).");

  return lines.join("\n");
}

export async function generateAgentReply(params: {
  systemPrompt: string;
  brand: BrandConfig;
  history: ChatTurn[];
  userMessage: string;
  context: AgentContext;
  llm: LlmConfig;
}): Promise<string> {
  const systemContent = [
    params.systemPrompt,
    "",
    buildRuntimeContext(params.brand, params.context),
  ].join("\n");

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemContent },
    ...params.history.map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: params.userMessage },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.llm.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.llm.model,
      messages,
      max_tokens: params.llm.maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned empty content");
  }

  return text;
}

export function buildFallbackReply(
  brand: BrandConfig,
  contactName: string | null,
  propertyCode: string | null,
): string {
  const greeting = contactName
    ? `Olá, ${contactName}! `
    : `Olá! Sou ${brand.assistantName}, da ${brand.brandName}. `;

  let text = `${greeting}Recebemos sua mensagem`;
  if (propertyCode) {
    text += ` sobre o imóvel ${propertyCode}`;
  }
  text += `. Em instantes retorno com mais detalhes.`;
  return text;
}
