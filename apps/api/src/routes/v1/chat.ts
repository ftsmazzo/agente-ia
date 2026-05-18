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
  buildHandoffReply,
  buildReturnToBotReply,
  wantsHumanHandoff,
  wantsReturnToBot,
} from "../../lib/handoff-intent.js";
import { extractQualificationFromMessage } from "../../lib/qualification-extract.js";
import {
  getConversationState,
  mergeConversationMetadata,
  setConversationMode,
  touchConversation,
} from "../../services/conversation-state.js";
import {
  attachAppointmentToLead,
  getContactDisplayName,
  mergeLeadQualification,
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
import {
  acceptsVisitAffirmative,
  botMessageInvitesVisit,
  prefersQualificationAtMeeting,
  prefersQualificationBeforeMeeting,
} from "../../lib/scheduling-intent.js";
import {
  bookAppointment,
  buildSlotOfferReply,
  findRequestedSlot,
  formatSlotLabel,
  formatSlotsForPrompt,
  listAvailableSlots,
} from "../../services/scheduling-service.js";

type SchedulingConversationState = {
  status?:
    | "awaiting_accept"
    | "awaiting_slot"
    | "booked"
    | "awaiting_qualification_choice"
    | "qualification_closed";
  visitPrompted?: boolean;
  offeredSlots?: string[];
  appointmentId?: number;
  propertyCode?: string | null;
  updatedAt?: string;
};

function getSchedulingState(
  metadata: Record<string, unknown> | undefined,
): SchedulingConversationState | null {
  const raw = metadata?.scheduling;
  if (!raw || typeof raw !== "object") return null;
  return raw as SchedulingConversationState;
}

function wantsScheduling(message: string): boolean {
  return /\b(agenda|agendar|marcar|visita|visitar|hor[aá]rio|horarios|horários)\b/i.test(
    message,
  );
}

function shouldDeferFinancialQualification(
  schedulingState: SchedulingConversationState | null,
): boolean {
  if (!schedulingState?.status) return false;
  return (
    schedulingState.status === "awaiting_accept" ||
    schedulingState.status === "awaiting_slot" ||
    schedulingState.status === "booked" ||
    schedulingState.status === "awaiting_qualification_choice"
  );
}

function buildBookedReply(
  brandName: string,
  label: string,
  location: string,
  contactName?: string | null,
): string {
  const who = contactName ? `${contactName}, ` : "";
  return `Perfeito, ${who}sua visita está confirmada na ${brandName} para ${label}.\n\nLocal: ${location}.\n\nSe quiser, posso anotar aqui algumas informações rápidas para agilizar o atendimento antes da visita — ou prefere conversar sobre tudo pessoalmente no dia? O que fica melhor para você?`;
}

function buildQualificationClosedReply(contactName?: string | null): string {
  const who = contactName ? `${contactName}, ` : "";
  return `Combinado, ${who}conversamos com calma na visita sobre financiamento, simulações e o que mais precisar. Qualquer dúvida até lá, é só me chamar.`;
}

async function offerSlotsDeterministic(
  app: FastifyInstance,
  params: {
    phone: string;
    messageId: string;
    message: string;
    propertyCode?: string | null;
    reason: string;
    slotMismatch?: boolean;
  },
): Promise<ChatResponse & { shouldReply: true; replyText: string }> {
  const slots = await listAvailableSlots(app.db, { limit: 5 });
  let replyText = buildSlotOfferReply(slots);
  if (params.slotMismatch) {
    replyText += `\n\nNão encontrei esse horário na agenda. Pode escolher uma das opções acima?`;
  }
  await mergeConversationMetadata(app.db, params.phone, {
    scheduling: {
      status: "awaiting_slot",
      visitPrompted: true,
      offeredSlots: slots.map((slot) => slot.startsAt),
      propertyCode: params.propertyCode,
      updatedAt: new Date().toISOString(),
    },
  });
  await appendHistory(
    app.redis,
    params.phone,
    params.message,
    replyText,
    app.config.llm.maxHistoryTurns,
  );
  await recordMessageEvent(app.db, {
    externalId: `${params.messageId}:out`,
    phone: params.phone,
    direction: "outbound",
    status: "queued",
    workflowStep: "chat",
    metadata: {
      reason: params.reason,
      slots: slots.map((slot) => ({
        option: slot.option,
        startsAt: slot.startsAt,
        label: slot.label,
      })),
    },
  });
  return {
    shouldReply: true,
    replyText,
    conversationMode: "bot",
    reason: params.reason,
  };
}

function appointmentPayload(params: {
  id: number;
  phone: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  location: string;
  customerName?: string | null;
  propertyCode?: string | null;
}) {
  return {
    id: params.id,
    phone: params.phone,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    label: formatSlotLabel(params.startsAt, params.timezone),
    location: params.location,
    customerName: params.customerName ?? null,
    propertyCode: params.propertyCode ?? null,
  };
}

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

      const conversationState = await getConversationState(app.db, phone);
      const mode = conversationState?.mode ?? "bot";
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

      const contactNameEarly =
        (await getContactDisplayName(app.db, phone)) ??
        resolveDisplayName(body.metadata, body.message);

      if (config.features.humanHandoff && wantsReturnToBot(body.message)) {
        await setConversationMode(app.db, phone, "bot", {
          reason: "client_return_to_bot",
        });
        const replyText = buildReturnToBotReply(
          config.brand.assistantName,
          contactNameEarly,
        );
        await recordMessageEvent(app.db, {
          externalId: `${body.messageId}:out`,
          phone,
          direction: "outbound",
          status: "queued",
          workflowStep: "chat",
          metadata: { reason: "return_to_bot" },
        });
        return reply.send({
          shouldReply: true,
          replyText,
          conversationMode: "bot",
          reason: "return_to_bot",
        } satisfies ChatResponse);
      }

      if (config.features.humanHandoff && wantsHumanHandoff(body.message)) {
        await setConversationMode(app.db, phone, "human", {
          reason: "client_requested_human",
        });
        const replyText = buildHandoffReply(
          config.brand.brandName,
          config.brand.assistantName,
          contactNameEarly,
        );
        await recordMessageEvent(app.db, {
          externalId: `${body.messageId}:out`,
          phone,
          direction: "outbound",
          status: "queued",
          workflowStep: "chat",
          metadata: { reason: "handoff_requested" },
        });
        return reply.send({
          shouldReply: true,
          replyText,
          conversationMode: "human",
          reason: "handoff_requested",
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

      const contactName = contactNameEarly ?? displayName;

      const schedulingState = getSchedulingState(conversationState?.metadata);
      const qualificationPatch = extractQualificationFromMessage(body.message);
      const deferFinancialQual =
        shouldDeferFinancialQualification(schedulingState);
      if (qualificationPatch && !deferFinancialQual) {
        await mergeLeadQualification(
          app.db,
          phone,
          extracted.propertyCode,
          qualificationPatch,
        ).catch((err) => {
          request.log.warn({ err, phone }, "qualification merge failed");
        });
      } else if (qualificationPatch?.visit_requested) {
        await mergeLeadQualification(
          app.db,
          phone,
          extracted.propertyCode,
          { visit_requested: true },
        ).catch((err) => {
          request.log.warn({ err, phone }, "qualification merge failed");
        });
      }

      if (
        config.features.scheduling &&
        schedulingState?.status === "awaiting_qualification_choice"
      ) {
        let replyText: string;
        if (prefersQualificationAtMeeting(body.message)) {
          replyText = buildQualificationClosedReply(contactName);
          await mergeConversationMetadata(app.db, phone, {
            scheduling: {
              ...schedulingState,
              status: "qualification_closed",
              updatedAt: new Date().toISOString(),
            },
          });
        } else if (prefersQualificationBeforeMeeting(body.message)) {
          replyText = buildQualificationClosedReply(contactName);
          await mergeConversationMetadata(app.db, phone, {
            scheduling: {
              ...schedulingState,
              status: "qualification_closed",
              updatedAt: new Date().toISOString(),
            },
          });
        } else {
          replyText =
            "Para eu seguir: prefere conversar sobre financiamento e perfil na visita, ou quer adiantar algo rápido por aqui antes do encontro?";
        }
        await appendHistory(
          app.redis,
          phone,
          body.message,
          replyText,
          config.llm.maxHistoryTurns,
        );
        await recordMessageEvent(app.db, {
          externalId: `${body.messageId}:out`,
          phone,
          direction: "outbound",
          status: "queued",
          workflowStep: "chat",
          metadata: { reason: "qualification_choice" },
        });
        return reply.send({
          shouldReply: true,
          replyText,
          conversationMode: "bot",
          reason: "qualification_choice",
        } satisfies ChatResponse);
      }

      const historyEarly = await loadHistory(
        app.redis,
        phone,
        config.llm.maxHistoryTurns,
      );
      const lastBotReply = [...historyEarly]
        .reverse()
        .find((turn) => turn.role === "assistant")?.content;
      const visitPrompted =
        schedulingState?.visitPrompted === true ||
        schedulingState?.status === "awaiting_accept" ||
        Boolean(lastBotReply && botMessageInvitesVisit(lastBotReply));
      const acceptsVisit =
        acceptsVisitAffirmative(body.message) &&
        (visitPrompted || Boolean(qualificationPatch?.visit_requested));
      const isAwaitingSchedulingChoice =
        schedulingState?.status === "awaiting_slot";
      const shouldHandleScheduling =
        config.features.scheduling &&
        (isAwaitingSchedulingChoice ||
          acceptsVisit ||
          Boolean(qualificationPatch?.visit_requested) ||
          wantsScheduling(body.message));

      if (shouldHandleScheduling) {
        const slots = await listAvailableSlots(app.db, { limit: 5 });
        const selectedSlot = findRequestedSlot(
          body.message,
          slots,
          config.brand.timezone,
        );

        if (selectedSlot) {
          const booking = await bookAppointment(app.db, {
            phone,
            startsAt: selectedSlot.startsAt,
            customerName: contactName,
            propertyCode:
              extracted.propertyCode ?? schedulingState?.propertyCode ?? null,
            metadata: {
              source_message_id: body.messageId,
              source: "sofia_chat",
            },
          });

          if (booking.ok) {
            const bookedPropertyCode =
              extracted.propertyCode ?? schedulingState?.propertyCode ?? null;
            await attachAppointmentToLead(app.db, phone, bookedPropertyCode, {
              id: booking.appointment.id,
              startsAt: booking.appointment.startsAt,
              endsAt: booking.appointment.endsAt,
              location: booking.appointment.location,
            });
            await mergeConversationMetadata(app.db, phone, {
              scheduling: {
                status: "awaiting_qualification_choice",
                appointmentId: booking.appointment.id,
                startsAt: booking.appointment.startsAt,
                propertyCode:
                  extracted.propertyCode ?? schedulingState?.propertyCode,
                updatedAt: new Date().toISOString(),
              },
            });

            const booked = appointmentPayload({
              id: booking.appointment.id,
              phone,
              startsAt: booking.appointment.startsAt,
              endsAt: booking.appointment.endsAt,
              timezone: booking.appointment.timezone,
              location: booking.appointment.location,
              customerName: contactName,
              propertyCode: bookedPropertyCode,
            });
            const replyText = buildBookedReply(
              config.brand.brandName,
              booked.label,
              booked.location,
              contactName,
            );

            await appendHistory(
              app.redis,
              phone,
              body.message,
              replyText,
              config.llm.maxHistoryTurns,
            );
            await recordMessageEvent(app.db, {
              externalId: `${body.messageId}:out`,
              phone,
              direction: "outbound",
              status: "queued",
              workflowStep: "chat",
              metadata: {
                reason: "appointment_booked",
                appointment: booked,
              },
            });

            return reply.send({
              shouldReply: true,
              replyText,
              conversationMode: "bot",
              reason: "appointment_booked",
              appointmentBooked: booked,
            } satisfies ChatResponse);
          }

          const replyText = `${buildSlotOfferReply(
            booking.slots.slice(0, 5),
          )}\n\nEsse horário acabou de ficar indisponível, então te mandei as opções atualizadas.`;
          await mergeConversationMetadata(app.db, phone, {
            scheduling: {
              status: "awaiting_slot",
              offeredSlots: booking.slots.slice(0, 5).map((slot) => slot.startsAt),
              propertyCode: extracted.propertyCode,
              updatedAt: new Date().toISOString(),
            },
          });
          await appendHistory(
            app.redis,
            phone,
            body.message,
            replyText,
            config.llm.maxHistoryTurns,
          );
          await recordMessageEvent(app.db, {
            externalId: `${body.messageId}:out`,
            phone,
            direction: "outbound",
            status: "queued",
            workflowStep: "chat",
            metadata: { reason: "appointment_slot_unavailable" },
          });
          return reply.send({
            shouldReply: true,
            replyText,
            conversationMode: "bot",
            reason: "appointment_slot_unavailable",
          } satisfies ChatResponse);
        }

        if (isAwaitingSchedulingChoice) {
          return reply.send(
            await offerSlotsDeterministic(app, {
              phone,
              messageId: body.messageId,
              message: body.message,
              propertyCode:
                extracted.propertyCode ?? schedulingState?.propertyCode,
              reason: "appointment_slot_retry",
              slotMismatch: true,
            }),
          );
        }

        if (
          acceptsVisit ||
          qualificationPatch?.visit_requested ||
          wantsScheduling(body.message)
        ) {
          return reply.send(
            await offerSlotsDeterministic(app, {
              phone,
              messageId: body.messageId,
              message: body.message,
              propertyCode: extracted.propertyCode,
              reason: "appointment_slots_offered",
            }),
          );
        }
      }

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

      const history = historyEarly;
      let schedulingBlock: string | undefined;
      if (
        config.features.scheduling &&
        schedulingState?.status !== "awaiting_slot" &&
        schedulingState?.status !== "qualification_closed"
      ) {
        const slots = await listAvailableSlots(app.db, { limit: 5 });
        schedulingBlock = formatSlotsForPrompt(slots);
      }

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
              schedulingBlock,
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

          if (
            config.features.scheduling &&
            botMessageInvitesVisit(replyText) &&
            schedulingState?.status !== "awaiting_slot" &&
            schedulingState?.status !== "awaiting_qualification_choice"
          ) {
            await mergeConversationMetadata(app.db, phone, {
              scheduling: {
                status: "awaiting_accept",
                visitPrompted: true,
                propertyCode: extracted.propertyCode,
                updatedAt: new Date().toISOString(),
              },
            });
          }
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
