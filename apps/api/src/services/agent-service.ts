import type { BrandConfig } from "@realty/shared";
import type { MessageIntent } from "../lib/message-intent.js";
import type { ChatTurn } from "./conversation-history.js";
import { textHasPropertyListings } from "../lib/rag-listing-detect.js";
import {
  createLlmProvider,
  historyToMessages,
  type LlmProviderConfig,
} from "./llm/index.js";

export type AgentContext = {
  contactName: string | null;
  propertyCode: string | null;
  intent: MessageIntent;
  /** Só critérios extraídos da mensagem atual (não do histórico Redis). */
  qualificationHint?: string;
};

function buildRuntimeContext(
  brand: BrandConfig,
  ctx: AgentContext,
): string {
  const lines = [
    "## Contexto desta conversa (sistema)",
    `- Nome do cliente: ${ctx.contactName ?? "ainda não informado"}`,
    `- Intenção detectada: ${ctx.intent}`,
  ];

  switch (ctx.intent) {
    case "property_by_code":
      lines.push(`- Código do anúvel: ${ctx.propertyCode}`);
      lines.push(
        "- Cenário: cliente veio de portal/site e clicou neste anúncio.",
      );
      lines.push(
        "- Use APENAS dados de imóveis marcados como [DADOS DO SISTEMA] abaixo. Se não houver bloco, diga que está verificando e qualifique interesse.",
      );
      break;
    case "property_by_criteria":
      lines.push(
        "- Cenário: busca por perfil (bairro, quartos, tipo) — sem código fixo.",
      );
      lines.push(
        "- Use APENAS imóveis listados em [DADOS DO SISTEMA]. Se a lista estiver vazia, faça perguntas para refinar (bairro, quartos, compra/aluguel, faixa de valor).",
      );
      lines.push("- Não invente códigos AP#### nem endereços.");
      if (ctx.qualificationHint) {
        lines.push(
          `- Nesta mensagem o cliente mencionou: ${ctx.qualificationHint}.`,
        );
      } else {
        lines.push(
          "- Nesta mensagem o cliente não detalhou quartos/banheiros — não confirme perfil que só apareceu em mensagens antigas.",
        );
      }
      break;
    default:
      lines.push(
        "- Conversa geral: acolha, descubra se busca imóvel, venda ou outro assunto.",
      );
  }

  lines.push(
    `- Marca: ${brand.brandName} | Assistente: ${brand.assistantName}`,
  );
  const nowLabel = new Date().toLocaleString("pt-BR", {
    timeZone: brand.timezone,
    dateStyle: "full",
    timeStyle: "short",
  });
  lines.push(`- Data/hora de referência: ${nowLabel} (${brand.timezone})`);
  lines.push(
    "- Formato: WhatsApp, português BR, mensagem concisa (até ~3 blocos curtos).",
  );

  return lines.join("\n");
}

/** Bloco injetado quando RAG/tabela estiver ligado (fase 2c) */
export function formatPropertyKnowledgeBlock(
  records: Array<Record<string, unknown>>,
): string {
  if (!records.length) {
    return "[DADOS DO SISTEMA]\nNenhum imóvel encontrado para estes critérios ainda.\n[/DADOS DO SISTEMA]";
  }
  const lines = records.map((r, i) => {
    const code = r.property_code ?? r.codigo ?? "?";
    const summary = r.summary ?? r.titulo ?? JSON.stringify(r);
    const link =
      typeof r.link === "string" && r.link.trim()
        ? ` | ${r.link.trim()}`
        : "";
    const score =
      typeof r.similarity === "number"
        ? ` (relevância ${(r.similarity * 100).toFixed(0)}%)`
        : "";
    return `${i + 1}. ${code}: ${summary}${link}${score}`;
  });
  return `[DADOS DO SISTEMA]\n${lines.join("\n")}\n[/DADOS DO SISTEMA]`;
}

export async function generateAgentReply(params: {
  systemPrompt: string;
  brand: BrandConfig;
  history: ChatTurn[];
  userMessage: string;
  context: AgentContext;
  llm: LlmProviderConfig;
  propertyKnowledge?: string;
}): Promise<string> {
  const parts = [
    params.systemPrompt,
    "",
    buildRuntimeContext(params.brand, params.context),
  ];

  if (params.propertyKnowledge) {
    parts.push("", params.propertyKnowledge);
    if (
      params.context.intent === "property_by_criteria" &&
      textHasPropertyListings(params.propertyKnowledge)
    ) {
      parts.push(
        "",
        "## Instrução obrigatória",
        "O bloco [DADOS DO SISTEMA] acima contém anúncios reais. Apresente até 3 opções (código AP, valor, bairro).",
        "É proibido dizer que não há imóveis no bairro se o bloco listar opções.",
        "Não confirme quartos, banheiros ou vagas que o cliente não disse na mensagem atual.",
      );
    }
  }

  const provider = createLlmProvider(params.llm);

  const messages = [
    { role: "system" as const, content: parts.join("\n") },
    ...historyToMessages(params.history),
    { role: "user" as const, content: params.userMessage },
  ];

  return provider.complete({
    messages,
    maxTokens: params.llm.maxTokens,
    temperature: 0.7,
  });
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
