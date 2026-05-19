import type { FastifyInstance } from "fastify";
import { chatRequestSchema, type ChatResponse } from "@realty/shared";
import { extractFromMessage } from "../../lib/extract-message.js";
import { findCatalogCodeInMessage } from "../../services/generic-catalog-service.js";
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
  buildEventMetadata,
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
  formatAgentConfigPromptBlock,
  getAgentConfig,
} from "../../services/agent-config-service.js";
import { fetchPropertyKnowledge } from "../../services/property-knowledge-service.js";
import { shouldQueryPropertyRag } from "../../services/property-rag-service.js";
import {
  acceptsVisitAffirmative,
  acceptsVisitAfterInvite,
  botMessageInvitesVisit,
  botMessageOfferedNumberedSlots,
  looksLikeSlotChoice,
  isAwaitingBookingFollowUp,
  resolveQualificationChoice,
} from "../../lib/scheduling-intent.js";
import {
  buildAppointmentIcsUrl,
  resolveOfficeLocation,
} from "../../lib/appointment-office.js";
import {
  buildAppointmentNotifyText,
  buildBookedClientReply,
} from "../../lib/appointment-notify.js";
import { extractPropertyCodesFromHistory } from "../../lib/property-codes-from-history.js";
import {
  bookAppointment,
  buildSlotOfferReply,
  findRequestedSlot,
  formatSlotLabel,
  formatSlotsForPrompt,
  getSchedulingSettings,
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
  startsAt?: string;
  propertyCode?: string | null;
  qualificationRetries?: number;
  updatedAt?: string;
};

function firstName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  return name.trim().split(/\s+/)[0] ?? null;
}

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

function visitLabelFromState(
  schedulingState: SchedulingConversationState | null,
  timezone: string,
): string | null {
  if (!schedulingState?.startsAt) return null;
  return formatSlotLabel(schedulingState.startsAt, timezone);
}

function buildQualificationClosedReply(
  contactName?: string | null,
  visitLabel?: string | null,
): string {
  const who = firstName(contactName);
  const greeting = who ? `${who}, ` : "";
  const visit = visitLabel ? ` Te espero na visita (${visitLabel}).` : "";
  return `Combinado, ${greeting}conversamos com calma na visita sobre o que precisar.${visit} Qualquer dúvida até lá, é só me chamar.`;
}

function buildQualificationDismissReply(
  contactName?: string | null,
  visitLabel?: string | null,
): string {
  const who = firstName(contactName);
  const greeting = who ? `${who}, ` : "";
  const visit = visitLabel
    ? ` Sua visita continua confirmada (${visitLabel}).`
    : "";
  return `Por nada, ${greeting}!${visit} Até lá — qualquer coisa, é só me chamar.`;
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
    metadata: buildEventMetadata(
      {
        reason: params.reason,
        slots: slots.map((slot) => ({
          option: slot.option,
          startsAt: slot.startsAt,
          label: slot.label,
        })),
      },
      replyText,
    ),
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
  officeDisplay: string;
  customerName?: string | null;
  propertyCode?: string | null;
  presentedPropertyCodes: string[];
  mapsUrl: string | null;
  icsUrl: string | null;
}) {
  return {
    id: params.id,
    phone: params.phone,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    label: formatSlotLabel(params.startsAt, params.timezone),
    location: params.officeDisplay,
    customerName: params.customerName ?? null,
    propertyCode: params.propertyCode ?? null,
    presentedPropertyCodes: params.presentedPropertyCodes,
    mapsUrl: params.mapsUrl,
    icsUrl: params.icsUrl,
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

    try {
      const agentConfig = await getAgentConfig(app.db);
      const tenantBlock = formatAgentConfigPromptBlock(agentConfig);
      return `${cachedSystemPrompt}\n\n${tenantBlock}`;
    } catch {
      return cachedSystemPrompt;
    }
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
          metadata: buildEventMetadata({ skipped: true }, body.message),
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
        metadata: buildEventMetadata(
          { messageType: body.messageType },
          body.message,
        ),
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
          metadata: buildEventMetadata(
            { reason: "return_to_bot" },
            replyText,
          ),
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
          metadata: buildEventMetadata(
            { reason: "handoff_requested" },
            replyText,
          ),
        });
        return reply.send({
          shouldReply: true,
          replyText,
          conversationMode: "human",
          reason: "handoff_requested",
        } satisfies ChatResponse);
      }

      const extracted = extractFromMessage(body.message);
      if (!extracted.propertyCode) {
        const fromCatalog = await findCatalogCodeInMessage(
          app.db,
          body.message,
        );
        if (fromCatalog) {
          extracted.propertyCode = fromCatalog;
          extracted.hasPropertyInterest = true;
        }
      }
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
        const visitLabel = visitLabelFromState(
          schedulingState,
          config.brand.timezone,
        );
        const choice = resolveQualificationChoice(body.message);
        const retries = schedulingState.qualificationRetries ?? 0;
        let replyText: string;

        if (choice === "at_meeting" || choice === "before") {
          replyText = buildQualificationClosedReply(contactName, visitLabel);
          await mergeConversationMetadata(app.db, phone, {
            scheduling: {
              ...schedulingState,
              status: "qualification_closed",
              updatedAt: new Date().toISOString(),
            },
          });
        } else if (choice === "dismiss") {
          replyText = buildQualificationDismissReply(contactName, visitLabel);
          await mergeConversationMetadata(app.db, phone, {
            scheduling: {
              ...schedulingState,
              status: "qualification_closed",
              updatedAt: new Date().toISOString(),
            },
          });
        } else if (retries >= 1) {
          replyText = buildQualificationDismissReply(contactName, visitLabel);
          await mergeConversationMetadata(app.db, phone, {
            scheduling: {
              ...schedulingState,
              status: "qualification_closed",
              updatedAt: new Date().toISOString(),
            },
          });
        } else {
          replyText =
            "Sem problema! Na visita conversamos com calma. Se preferir adiantar algo por aqui antes, é só dizer — ou responda “na visita”.";
          await mergeConversationMetadata(app.db, phone, {
            scheduling: {
              ...schedulingState,
              qualificationRetries: retries + 1,
              updatedAt: new Date().toISOString(),
            },
          });
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
          metadata: buildEventMetadata(
            { reason: "qualification_choice" },
            replyText,
          ),
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
        (acceptsVisitAffirmative(body.message) ||
          (visitPrompted && acceptsVisitAfterInvite(body.message))) &&
        (visitPrompted || Boolean(qualificationPatch?.visit_requested));
      const isAwaitingSchedulingChoice =
        schedulingState?.status === "awaiting_slot";
      const isAwaitingVisitAccept =
        schedulingState?.status === "awaiting_accept";
      const slotChoiceMessage = looksLikeSlotChoice(body.message);
      const bookingFollowUp =
        isAwaitingBookingFollowUp(body.message) &&
        (schedulingState?.visitPrompted === true ||
          isAwaitingVisitAccept ||
          isAwaitingSchedulingChoice);
      const lastBotOfferedSlots = Boolean(
        lastBotReply && botMessageOfferedNumberedSlots(lastBotReply),
      );
      const mustBlockLlmForScheduling =
        isAwaitingSchedulingChoice ||
        isAwaitingVisitAccept ||
        lastBotOfferedSlots ||
        slotChoiceMessage ||
        bookingFollowUp ||
        acceptsVisit;
      const shouldHandleScheduling =
        config.features.scheduling &&
        (isAwaitingSchedulingChoice ||
          isAwaitingVisitAccept ||
          slotChoiceMessage ||
          bookingFollowUp ||
          lastBotOfferedSlots ||
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
                qualificationRetries: 0,
                updatedAt: new Date().toISOString(),
              },
            });

            const schedulingSettings = await getSchedulingSettings(app.db);
            const office = resolveOfficeLocation(schedulingSettings);
            const historyForCodes = await loadHistory(
              app.redis,
              phone,
              config.llm.maxHistoryTurns,
            );
            const presentedPropertyCodes =
              extractPropertyCodesFromHistory(historyForCodes);
            const icsUrl = buildAppointmentIcsUrl(booking.appointment.id);

            const booked = appointmentPayload({
              id: booking.appointment.id,
              phone,
              startsAt: booking.appointment.startsAt,
              endsAt: booking.appointment.endsAt,
              timezone: booking.appointment.timezone,
              officeDisplay: office.display,
              customerName: contactName,
              propertyCode: bookedPropertyCode,
              presentedPropertyCodes,
              mapsUrl: office.mapsUrl,
              icsUrl,
            });

            const who = firstName(contactName);
            const greeting = who ? `${who}, ` : "";
            const replyText = buildBookedClientReply({
              brandName: config.brand.brandName,
              greeting,
              label: booked.label,
              office,
            });

            const appointmentNotifyText = buildAppointmentNotifyText({
              customerName: contactName,
              phone,
              label: booked.label,
              office,
              propertyCode: bookedPropertyCode,
              presentedPropertyCodes,
              icsUrl,
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
              metadata: buildEventMetadata(
                {
                  reason: "appointment_booked",
                  appointment: booked,
                },
                replyText,
              ),
            });

            return reply.send({
              shouldReply: true,
              replyText,
              conversationMode: "bot",
              reason: "appointment_booked",
              appointmentBooked: booked,
              appointmentNotifyText,
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
            metadata: buildEventMetadata(
              { reason: "appointment_slot_unavailable" },
              replyText,
            ),
          });
          return reply.send({
            shouldReply: true,
            replyText,
            conversationMode: "bot",
            reason: "appointment_slot_unavailable",
          } satisfies ChatResponse);
        }

        if (
          isAwaitingSchedulingChoice ||
          slotChoiceMessage ||
          lastBotOfferedSlots
        ) {
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
          bookingFollowUp ||
          qualificationPatch?.visit_requested ||
          wantsScheduling(body.message)
        ) {
          return reply.send(
            await offerSlotsDeterministic(app, {
              phone,
              messageId: body.messageId,
              message: body.message,
              propertyCode:
                extracted.propertyCode ?? schedulingState?.propertyCode,
              reason: bookingFollowUp
                ? "appointment_booking_followup"
                : "appointment_slots_offered",
            }),
          );
        }
      }

      if (config.features.scheduling && mustBlockLlmForScheduling) {
        return reply.send(
          await offerSlotsDeterministic(app, {
            phone,
            messageId: body.messageId,
            message: body.message,
            propertyCode:
              extracted.propertyCode ?? schedulingState?.propertyCode,
            reason: slotChoiceMessage
              ? "scheduling_funnel_slot_retry"
              : "scheduling_funnel_guard",
            slotMismatch: slotChoiceMessage || lastBotOfferedSlots,
          }),
        );
      }

      let replyText: string;
      let reason: string;
      let llmErrorDetail: string | undefined;
      let ragMeta:
        | {
            source?: string;
            sourceCount: number;
            ragQuery?: string;
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
        !mustBlockLlmForScheduling &&
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
          const knowledgeResult = await fetchPropertyKnowledge({
            pool: app.db,
            rag: config.rag,
            brand: config.brand,
            userMessage: body.message,
            intent,
            propertyCode: extracted.propertyCode,
            history,
          });
          if (knowledgeResult) {
            propertyKnowledge = knowledgeResult.block;
            ragMeta = {
              source: knowledgeResult.source,
              sourceCount: knowledgeResult.sourceCount,
              ragQuery: knowledgeResult.ragQuery,
              parsedListings: knowledgeResult.parsedListings,
              matchedListings: knowledgeResult.matchedListings,
              hadRagAnswer: knowledgeResult.hadRagAnswer,
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
            ? ragMeta && "source" in ragMeta && ragMeta.source === "catalog"
              ? `llm_${config.llm.provider}_catalog`
              : `llm_${config.llm.provider}_rag`
            : `llm_${config.llm.provider}`;

          await appendHistory(
            app.redis,
            phone,
            body.message,
            replyText,
            config.llm.maxHistoryTurns,
          );

          if (config.features.scheduling) {
            if (
              botMessageOfferedNumberedSlots(replyText) &&
              schedulingState?.status !== "awaiting_qualification_choice"
            ) {
              const slotsForMeta = await listAvailableSlots(app.db, {
                limit: 5,
              });
              await mergeConversationMetadata(app.db, phone, {
                scheduling: {
                  status: "awaiting_slot",
                  visitPrompted: true,
                  offeredSlots: slotsForMeta.map((slot) => slot.startsAt),
                  propertyCode:
                    extracted.propertyCode ?? schedulingState?.propertyCode,
                  updatedAt: new Date().toISOString(),
                },
              });
            } else if (
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
        metadata: buildEventMetadata(
          {
            reason,
            intent,
            model: config.llm.model,
            ...(ragMeta && { rag: ragMeta }),
            ...(ragSkipReason && { ragSkipReason }),
            ...(llmErrorDetail && { llmError: llmErrorDetail.slice(0, 500) }),
          },
          replyText,
        ),
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
