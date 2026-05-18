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
  schedulingBlock?: string;
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
    "- Formato: WhatsApp, português BR, tom de corretora experiente (calorosa, persuasiva, sem parecer catálogo ou robô).",
  );
  lines.push(
    "- Até ~3 blocos curtos; evite listas com títulos técnicos (ex.: 'Opções (código — valor — bairro)').",
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
    if (typeof r.card === "string" && r.card.trim()) {
      return r.card.trim();
    }
    const code = r.property_code ?? r.codigo ?? "?";
    const summary = r.summary ?? r.titulo ?? JSON.stringify(r);
    const link =
      typeof r.link === "string" && r.link.trim()
        ? `\nLink: ${r.link.trim()}`
        : "";
    return `IMÓVEL ${i + 1} — ${code}\n${summary}${link}`;
  });
  return `[DADOS DO SISTEMA]
Use as fichas abaixo para redigir a resposta (tom humano, WhatsApp). Não copie rótulos como "Opções (código — valor)".

${lines.join("\n\n")}

[/DADOS DO SISTEMA]`;
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
        "## Instrução obrigatória (tom humano)",
        "O bloco [DADOS DO SISTEMA] traz fichas reais (código AP, valor, bairro, metragem, link).",
        "Apresente até 3 imóveis em linguagem natural — como uma corretora contando para um amigo: gancho emocional + 2–3 dados + link em linha separada.",
        "Proibido: títulos de catálogo, tabelas, bullets com 'código — valor — bairro' em sequência mecânica.",
        "É proibido dizer que não há imóveis no bairro se o bloco listar opções.",
        "Não confirme quartos, banheiros ou vagas que o cliente não disse na mensagem atual.",
        "Convite à visita na imobiliária: leve, no final, sem pressão — sem perguntas financeiras.",
      );
    }
  }

  if (params.context.schedulingBlock) {
    parts.push("", params.context.schedulingBlock);
    parts.push(
      "",
      "## Instrução obrigatória (agenda)",
      "Use somente os horários listados em [AGENDA DO SISTEMA].",
      "Não invente datas, horários, disponibilidade, endereço ou confirmação de agenda.",
      "Se o cliente pedir um horário fora da lista, ofereça os horários disponíveis ou diga que vai verificar com a equipe.",
      "Não pergunte renda, financiamento, entrada, FGTS, simulações ou prazo de compra até a visita estar confirmada pelo sistema.",
      "Se o cliente aceitar visita, convide e pare — o sistema enviará a lista numerada de horários.",
    );
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
