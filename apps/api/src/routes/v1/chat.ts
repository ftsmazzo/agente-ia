import type { FastifyInstance } from "fastify";
import { chatRequestSchema, type ChatResponse } from "@realty/shared";
import { extractFromMessage } from "../../lib/extract-message.js";
import { classifyMessageIntent } from "../../lib/message-intent.js";
import {
  extractRagSearchCriteria,
  formatQualificationHint,
} from "../../lib/rag-search-criteria.js";
import { resolveDisplayName } from "../../lib/resolve-display-name.js";
import {
  composeSystemPrompt,
  loadPromptBundle,
} from "../../lib/prompt-bundle.js";
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
import {
  appendHistory,
  loadHistory,
} from "../../services/conversation-history.js";
import {
  buildFallbackReply,
  generateAgentReply,
} from "../../services/agent-service.js";
import {
  fetchPropertyKnowledgeFromRag,
  shouldQueryPropertyRag,
} from "../../services/property-rag-service.js";

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  const config = app.config;
  let cachedSystemPrompt: string | null = null;

  async function getSystemPrompt(): Promise<string> {
    if (!cachedSystemPrompt) {
      const bundle = await loadPromptBundle(
        config.brand,
        config.systemPromptPath,
        config.personaPromptPath,
      );
      cachedSystemPrompt = composeSystemPrompt(bundle);
    }
    return cachedSystemPrompt;
  }

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

        return reply.send({
          shouldReply: false,
          conversationMode: "bot",
          reason: "duplicate_message",
        } satisfies ChatResponse);
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
        return reply.send({
          shouldReply: false,
          conversationMode: mode,
          reason: "human_handoff",
        } satisfies ChatResponse);
      }

      const extracted = extractFromMessage(body.message);
      const intent = classifyMessageIntent(body.message, extracted);
      const displayName = resolveDisplayName(body.metadata, body.message);

      await upsertLeadFromMessage(
        app.db,
        phone,
        extracted,
        displayName,
      );

      const contactName =
        (await getContactDisplayName(app.db, phone)) ?? displayName;

      let replyText: string;
      let reason: string;
      let llmErrorDetail: string | undefined;
      let ragMeta:
        | {
            sourceCount: number;
            ragQuery: string;
            parsedListings?: number;
            matchedListings?: number;
            hadRagAnswer?: boolean;
          }
        | { error: string }
        | undefined;

      const history = await loadHistory(
        app.redis,
        phone,
        config.llm.maxHistoryTurns,
      );

      let propertyKnowledge: string | undefined;
      let ragSkipReason: string | undefined;
      if (!config.rag.enabled) {
        ragSkipReason = config.features.propertyRag
          ? "rag_not_configured"
          : "feature_property_rag_off";
      } else if (!shouldQueryPropertyRag(config.rag, intent)) {
        ragSkipReason = `intent_${intent}`;
      }

      if (config.rag.enabled && shouldQueryPropertyRag(config.rag, intent)) {
        try {
          const ragResult = await fetchPropertyKnowledgeFromRag({
            rag: config.rag,
            brand: config.brand,
            userMessage: body.message,
            intent,
            propertyCode: extracted.propertyCode,
            history,
          });
          if (ragResult) {
            propertyKnowledge = ragResult.block;
            ragMeta = {
              sourceCount: ragResult.sourceCount,
              ragQuery: ragResult.ragQuery,
              parsedListings: ragResult.parsedListings,
              matchedListings: ragResult.matchedListings,
              hadRagAnswer: ragResult.hadRagAnswer,
            };
          }
        } catch (ragErr) {
          const ragError =
            ragErr instanceof Error ? ragErr.message : String(ragErr);
          ragMeta = { error: ragError.slice(0, 300) };
          request.log.warn({ err: ragErr, intent }, "RAG query failed");
        }
      }

      if (config.llm.enabled) {
        try {
          const currentCriteria = extractRagSearchCriteria(body.message, []);
          const qualificationHint =
            formatQualificationHint(currentCriteria) ?? undefined;

          replyText = await generateAgentReply({
            systemPrompt: await getSystemPrompt(),
            brand: config.brand,
            history,
            userMessage: body.message,
            context: {
              contactName,
              propertyCode: extracted.propertyCode,
              intent,
              qualificationHint,
            },
            llm: {
              provider: config.llm.provider,
              apiKey: config.llm.apiKey,
              model: config.llm.model,
              maxTokens: config.llm.maxTokens,
            },
            propertyKnowledge,
          });
          reason = propertyKnowledge
            ? `llm_${config.llm.provider}_rag`
            : `llm_${config.llm.provider}`;

          await appendHistory(
            app.redis,
            phone,
            body.message,
            replyText,
            config.llm.maxHistoryTurns,
          );
        } catch (llmErr) {
          llmErrorDetail =
            llmErr instanceof Error ? llmErr.message : String(llmErr);
          request.log.warn(
            { err: llmErr, llmError: llmErrorDetail, model: config.llm.model },
            "LLM failed, using fallback",
          );
          replyText = buildFallbackReply(
            config.brand,
            contactName,
            extracted.propertyCode,
          );
          reason = "llm_fallback";
        }
      } else {
        replyText = buildFallbackReply(
          config.brand,
          contactName,
          extracted.propertyCode,
        );
        reason = "no_llm_key";
      }

      const response: ChatResponse = {
        shouldReply: true,
        replyText,
        replyAudio:
          config.features.audioReply && body.messageType === "audio",
        conversationMode: "bot",
        reason,
        ...(llmErrorDetail && { llmError: llmErrorDetail.slice(0, 500) }),
      };

      await recordMessageEvent(app.db, {
        externalId: `${body.messageId}:out`,
        phone,
        direction: "outbound",
        status: "queued",
        workflowStep: "chat",
        metadata: {
          reason,
          intent,
          model: config.llm.model,
          ...(ragMeta && { rag: ragMeta }),
          ...(ragSkipReason && { ragSkipReason }),
          ...(llmErrorDetail && { llmError: llmErrorDetail.slice(0, 500) }),
        },
      });

      request.log.info(
        {
          messageId: body.messageId,
          intent,
          provider: config.llm.provider,
          model: config.llm.model,
          ragUsed: Boolean(propertyKnowledge),
          ...(ragMeta && "sourceCount" in ragMeta
            ? { ragSources: ragMeta.sourceCount }
            : {}),
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
      }).catch(() => undefined);

      return reply.status(500).send({
        error: "chat_processing_failed",
        message,
      });
    }
  });
}
