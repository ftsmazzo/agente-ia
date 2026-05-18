import type { FastifyInstance } from "fastify";
import { chatRequestSchema } from "@realty/shared";
import { z } from "zod";
import { waitDebounceAndMerge } from "../../services/message-debounce.js";

const debounceBodySchema = chatRequestSchema.extend({
  debounceMs: z.number().int().min(500).max(15_000).optional(),
  maxWaitMs: z.number().int().min(2_000).max(30_000).optional(),
});

export async function debounceRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/debounce/wait-and-merge", async (request, reply) => {
    const parsed = debounceBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    const phone = body.phone.replace(/\D/g, "");
    const defaultMs = Number(process.env.DEBOUNCE_MS ?? 5000);
    const debounceMs =
      body.debounceMs ??
      (Number.isFinite(defaultMs) && defaultMs > 0 ? defaultMs : 5000);

    const defaultMax = Number(process.env.DEBOUNCE_MAX_WAIT_MS ?? 20_000);
    const maxWaitMs =
      body.maxWaitMs ??
      (Number.isFinite(defaultMax) && defaultMax > 0 ? defaultMax : 20_000);

    const result = await waitDebounceAndMerge({
      redis: app.redis,
      phone,
      payload: { ...body, phone },
      debounceMs,
      maxWaitMs,
    });

    request.log.info(
      {
        phone,
        process: result.process,
        reason: result.reason,
        waitedMs: result.waitedMs,
        ...(result.process
          ? { messageCount: result.messageCount }
          : {}),
      },
      "debounce wait-and-merge",
    );

    return reply.send(result);
  });
}
