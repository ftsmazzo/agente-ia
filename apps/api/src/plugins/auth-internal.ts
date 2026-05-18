import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * Validates X-API-Key for internal calls from n8n (not public internet).
 */
export async function registerInternalAuth(
  app: FastifyInstance,
  apiKey: string,
): Promise<void> {
  app.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.url === "/health" || request.url.startsWith("/health?")) {
        return;
      }

      const path = request.url.split("?")[0];
      if (!path.startsWith("/v1/")) {
        return;
      }

      // Link .ics aberto no celular/navegador (alerta WhatsApp ao corretor)
      if (
        request.method === "GET" &&
        /^\/v1\/scheduling\/appointments\/\d+\/ics$/.test(path)
      ) {
        return;
      }

      const provided = request.headers["x-api-key"];
      if (provided !== apiKey) {
        return reply.status(401).send({
          error: "unauthorized",
          message: "Invalid or missing X-API-Key",
        });
      }
    },
  );
}
