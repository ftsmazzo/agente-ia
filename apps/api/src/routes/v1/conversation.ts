import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resetConversationForPhone } from "../../services/conversation-reset.js";
import {
  getConversationState,
  setConversationMode,
  type ConversationMode,
} from "../../services/conversation-state.js";

const modeBodySchema = z.object({
  phone: z.string().min(8).max(32),
  mode: z.enum(["bot", "human", "paused"]),
  assigneeRef: z.string().max(128).optional(),
  reason: z.string().max(128).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function conversationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/conversation", async (request, reply) => {
    const phone = z
      .string()
      .min(8)
      .parse((request.query as { phone?: string }).phone)
      .replace(/\D/g, "");

    const state = await getConversationState(app.db, phone);
    if (!state) {
      return reply.send({
        phone,
        mode: "bot" as ConversationMode,
        assigneeRef: null,
        exists: false,
      });
    }

    return reply.send({
      phone: state.phone,
      mode: state.mode,
      assigneeRef: state.assignee_ref,
      lastMessageAt: state.last_message_at,
      metadata: state.metadata,
      exists: true,
    });
  });

  app.post("/v1/conversation/mode", async (request, reply) => {
    const parsed = modeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }

    const { phone: rawPhone, mode, assigneeRef, reason, metadata } =
      parsed.data;
    const phone = rawPhone.replace(/\D/g, "");

    await setConversationMode(app.db, phone, mode, {
      assigneeRef: assigneeRef ?? null,
      reason,
      metadataPatch: metadata,
    });

    request.log.info({ phone, mode, reason }, "conversation mode updated");

    return reply.send({
      ok: true,
      phone,
      mode,
      assigneeRef: assigneeRef ?? null,
    });
  });

  app.post("/v1/conversation/reset", async (request, reply) => {
    const parsed = z
      .object({
        phone: z.string().min(8).max(32),
        cancelAppointments: z.boolean().optional(),
      })
      .safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }

    const phone = parsed.data.phone.replace(/\D/g, "");
    const result = await resetConversationForPhone(
      app.db,
      app.redis,
      phone,
      { cancelAppointments: parsed.data.cancelAppointments },
    );

    request.log.info({ phone, ...result }, "conversation reset");

    return reply.send({
      ok: true,
      phone,
      ...result,
    });
  });
}
