import type { FastifyInstance } from "fastify";
import { runOpsNotificationTick } from "../../services/ops-notifications-service.js";

export async function opsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/ops/notifications/tick", async (request, reply) => {
    const portalBaseUrl =
      (request.body as { portalBaseUrl?: string } | undefined)?.portalBaseUrl ??
      process.env.PORTAL_PUBLIC_URL?.trim() ??
      null;

    const result = await runOpsNotificationTick(app.db, app.config.brand, {
      portalBaseUrl,
    });

    return reply.send({
      ok: true,
      count: result.messages.length,
      messages: result.messages,
    });
  });
}
