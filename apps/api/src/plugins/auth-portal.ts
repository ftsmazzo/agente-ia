import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  getPortalUserById,
  verifyPortalToken,
  type PortalRole,
  type PortalUser,
} from "../services/portal-auth-service.js";

declare module "fastify" {
  interface FastifyRequest {
    portalUser?: PortalUser;
  }
}

const PUBLIC_PATHS = new Set(["/v1/portal/auth/login"]);

export async function registerPortalAuth(
  app: FastifyInstance,
  jwtSecret: string,
): Promise<void> {
  app.decorateRequest("portalUser", undefined);

  app.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const path = request.url.split("?")[0];
      if (!path.startsWith("/v1/portal/")) return;
      if (PUBLIC_PATHS.has(path)) return;

      const header = request.headers.authorization;
      const token =
        header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
      if (!token) {
        return reply.status(401).send({
          error: "unauthorized",
          message: "Token de portal ausente",
        });
      }

      const claims = await verifyPortalToken(token, jwtSecret);
      if (!claims) {
        return reply.status(401).send({
          error: "unauthorized",
          message: "Sessão inválida ou expirada",
        });
      }

      const user = await getPortalUserById(app.db, claims.userId);
      if (!user) {
        return reply.status(401).send({
          error: "unauthorized",
          message: "Usuário não encontrado",
        });
      }

      request.portalUser = user;
    },
  );
}

export function requirePortalRole(
  roles: PortalRole[],
): (request: FastifyRequest, reply: FastifyReply) => Promise<void | FastifyReply> {
  return async (request, reply) => {
    const user = request.portalUser;
    if (!user || !roles.includes(user.role)) {
      return reply.status(403).send({
        error: "forbidden",
        message: "Sem permissão para esta ação",
      });
    }
  };
}
