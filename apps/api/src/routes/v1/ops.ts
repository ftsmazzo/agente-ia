import type { FastifyInstance } from "fastify";
import { runOpsNotificationTick } from "../../services/ops-notifications-service.js";

export async function opsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/ops/notifications/tick", async (_request, reply) => {
    const result = await runOpsNotificationTick(app.db, app.config.brand);

    return reply.send({
      ok: true,
      count: result.messages.length,
      messages: result.messages,
    });
  });
}
