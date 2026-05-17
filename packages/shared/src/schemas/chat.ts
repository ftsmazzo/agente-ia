import { z } from "zod";

/** Incoming chat request from n8n orchestrator */
export const chatRequestSchema = z.object({
  messageId: z.string().min(1),
  phone: z.string().min(8).max(32),
  message: z.string().min(1),
  timestamp: z.union([z.string(), z.number()]).optional(),
  instance: z.string().optional(),
  messageType: z.enum(["text", "audio", "image", "other"]).default("text"),
  metadata: z.record(z.unknown()).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatResponseSchema = z.object({
  shouldReply: z.boolean(),
  replyText: z.string().optional(),
  replyAudio: z.boolean().optional(),
  conversationMode: z.enum(["bot", "human", "paused"]),
  reason: z.string().optional(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;
