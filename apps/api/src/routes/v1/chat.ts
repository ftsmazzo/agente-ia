import type { FastifyInstance } from "fastify";
import { chatRequestSchema, type ChatResponse } from "@realty/shared";
import { extractFromMessage } from "../../lib/extract-message.js";
import { resolveDisplayName } from "../../lib/resolve-display-name.js";
import { loadSystemPrompt } from "../../lib/prompt-loader.js";
import { claimMessage } from "../../services/idempotency.js";
import {
  recordFailedMessage,
  recordMessageEvent,
} from "../../services/message-events.js";
import {
  getConversationMode,
  touchConversation,
} from "../../services/conversation-state.js";
import {
  getContactDisplayName,
  upsertLeadFromMessage,
} from "../../services/lead-service.js";

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  const config = app.config;
  let cachedPrompt: string | null = null;

  app.post("/v1/chat", async (request, reply) => {
    const parsed = chatRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    const phone = body.phone.replace(/\D/g, "");

    try {
      const isNew = await claimMessage(app.redis, body.messageId);
      if (!isNew) {
        await recordMessageEvent(app.db, {
          externalId: body.messageId,
          phone,
          direction: "inbound",
          status: "duplicate",
          workflowStep: "chat",
          metadata: { skipped: true },
        });

        const response: ChatResponse = {
          shouldReply: false,
          conversationMode: "bot",
          reason: "duplicate_message",
        };
        return reply.send(response);
      }

      await recordMessageEvent(app.db, {
        externalId: body.messageId,
        phone,
        direction: "inbound",
        status: "received",
        workflowStep: "chat",
        metadata: { messageType: body.messageType },
      });

      const mode = await getConversationMode(app.db, phone);
      await touchConversation(app.db, phone, mode);

      if (
        config.features.humanHandoff &&
        (mode === "human" || mode === "paused")
      ) {
        const response: ChatResponse = {
          shouldReply: false,
          conversationMode: mode,
          reason: "human_handoff",
        };
        return reply.send(response);
      }

      const extracted = extractFromMessage(body.message);
      const displayName = resolveDisplayName(body.metadata, body.message);

      await upsertLeadFromMessage(
        app.db,
        phone,
        extracted,
        displayName,
      );

      if (!cachedPrompt) {
        cachedPrompt = await loadSystemPrompt(
          config.systemPromptPath,
          config.brand,
        );
      }

      const contactName = await getContactDisplayName(app.db, phone);
      const greeting = contactName
        ? `Olá, ${contactName}! `
        : `Olá! Sou ${config.brand.assistantName}, da ${config.brand.brandName}. `;

      let replyText = `${greeting}Recebemos sua mensagem`;
      if (extracted.propertyCode) {
        replyText += ` sobre o imóvel ${extracted.propertyCode}`;
      }
      replyText += `. Em breve nossa equipe inteligente responderá com mais detalhes.`;

      const response: ChatResponse = {
        shouldReply: true,
        replyText,
        replyAudio:
          config.features.audioReply && body.messageType === "audio",
        conversationMode: "bot",
        reason: "phase_1_ack",
      };

      const outboundId = `${body.messageId}:out`;
      await recordMessageEvent(app.db, {
        externalId: outboundId,
        phone,
        direction: "outbound",
        status: "queued",
        workflowStep: "chat",
        metadata: { reason: response.reason },
      });

      request.log.info(
        {
          messageId: body.messageId,
          phone: phone.slice(-4).padStart(phone.length, "*"),
          propertyCode: extracted.propertyCode,
          mode,
        },
        "chat processed",
      );

      return reply.send(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      request.log.error({ err, messageId: body.messageId }, "chat failed");

      await recordFailedMessage(app.db, {
        externalId: body.messageId,
        phone,
        payload: { body },
        errorMessage: message,
      }).catch((logErr) => request.log.error({ logErr }, "failed to log DLQ"));

      await recordMessageEvent(app.db, {
        externalId: body.messageId,
        phone,
        direction: "inbound",
        status: "error",
        workflowStep: "chat",
        errorMessage: message,
      }).catch(() => undefined);

      return reply.status(500).send({
        error: "chat_processing_failed",
        message,
      });
    }
  });
}
