import { z } from "zod";

/** Incoming chat request from n8n orchestrator */
export const chatRequestSchema = z.object({
  messageId: z.string().min(1),
  phone: z.string().min(8).max(32),
  message: z.string().min(1),
  timestamp: z.union([z.string(), z.number()]).optional(),
  instance: z.string().optional(),
  messageType: z.enum(["text", "audio", "image", "other"]).default("text"),
  /** WhatsApp pushName / notifyName — enviado pelo n8n a partir do webhook Evolution */
  metadata: z
    .object({
      displayName: z.string().optional(),
      pushName: z.string().optional(),
      whatsappName: z.string().optional(),
      notifyName: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatResponseSchema = z.object({
  shouldReply: z.boolean(),
  replyText: z.string().optional(),
  replyAudio: z.boolean().optional(),
  conversationMode: z.enum(["bot", "human", "paused"]),
  reason: z.string().optional(),
  appointmentBooked: z
    .object({
      id: z.number(),
      phone: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      label: z.string(),
      location: z.string(),
      customerName: z.string().nullable().optional(),
      propertyCode: z.string().nullable().optional(),
      presentedPropertyCodes: z.array(z.string()).optional(),
      mapsUrl: z.string().nullable().optional(),
      icsUrl: z.string().nullable().optional(),
    })
    .optional(),
  /** Texto pronto para WhatsApp do corretor (n8n só repassa). */
  appointmentNotifyText: z.string().optional(),
  /** Presente quando reason = llm_fallback (debug no n8n) */
  llmError: z.string().optional(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;
