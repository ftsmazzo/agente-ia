import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  formatAgentConfigPromptBlock,
  getAgentConfig,
  updateAgentConfig,
} from "../../services/agent-config-service.js";
import {
  authenticatePortalUser,
  createPortalUser,
  signPortalToken,
} from "../../services/portal-auth-service.js";
import { requirePortalRole } from "../../plugins/auth-portal.js";
import {
  getSchedulingSettings,
  listAppointments,
  updateSchedulingSettings,
  type AppointmentStatus,
} from "../../services/scheduling-service.js";
import {
  importCatalogCsv,
  previewCatalogCsv,
} from "../../services/catalog-import-bridge.js";
import {
  exportCatalogAsCsv,
  getCatalogStats,
} from "../../services/generic-catalog-service.js";
import {
  listFailedMessages,
  resolveFailedMessage,
} from "../../services/portal-ops-service.js";
import {
  getConversationThread,
  listConversations,
} from "../../services/portal-conversations-service.js";
import { listPortalContacts } from "../../services/portal-contacts-service.js";
import { resetConversationForPhone } from "../../services/conversation-reset.js";
import { setConversationMode } from "../../services/conversation-state.js";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppStatus,
} from "../../services/evolution-service.js";
import {
  getDashboardHealthSummary,
  getSystemOverview,
} from "../../services/portal-system-service.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(120),
});

const settingsPatchSchema = z.object({
  timezone: z.string().max(64).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  workStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotMinutes: z.number().int().min(15).max(240).optional(),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  minNoticeMinutes: z.number().int().min(0).max(10080).optional(),
  horizonDays: z.number().int().min(1).max(60).optional(),
  location: z.string().max(500).optional(),
  address: z.string().max(1000).nullable().optional(),
  mapsUrl: z
    .union([z.string().url().max(2000), z.literal("")])
    .nullable()
    .optional(),
  active: z.boolean().optional(),
});

const agentPatchSchema = z.object({
  companyProfile: z.string().max(8000).optional(),
  tone: z
    .enum(["professional_warm", "formal", "casual", "enthusiastic"])
    .optional(),
  objectives: z
    .object({
      schedule: z.boolean(),
      capture: z.boolean(),
      qualify: z.boolean(),
    })
    .optional(),
  customRules: z.string().max(4000).optional(),
});

const blackoutSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  label: z.string().max(255).optional(),
});

const conversationModeSchema = z.object({
  mode: z.enum(["bot", "human", "paused"]),
  reason: z.string().max(128).optional(),
});

export async function portalRoutes(app: FastifyInstance): Promise<void> {
  const { portal, brand, features } = app.config;

  app.post("/v1/portal/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }

    const user = await authenticatePortalUser(
      app.db,
      parsed.data.email,
      parsed.data.password,
    );
    if (!user) {
      return reply.status(401).send({
        error: "invalid_credentials",
        message: "E-mail ou senha incorretos",
      });
    }

    const token = await signPortalToken(user, portal.jwtSecret);
    return reply.send({ token, user });
  });

  app.get("/v1/portal/auth/me", async (request, reply) => {
    return reply.send({ user: request.portalUser });
  });

  app.get("/v1/portal/catalog", async (_request, reply) => {
    const stats = await getCatalogStats(app.db);
    return reply.send({ catalog: stats });
  });

  app.post("/v1/portal/catalog/preview", async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({
        error: "missing_file",
        message: "Envie o arquivo CSV no campo file",
      });
    }

    const filename = file.filename.toLowerCase();
    if (!filename.endsWith(".csv") && !filename.endsWith(".txt")) {
      return reply.status(400).send({
        error: "invalid_file",
        message: "Use arquivo CSV (.csv)",
      });
    }

    const buffer = await file.toBuffer();
    const preview = await previewCatalogCsv(buffer);
    return reply.send({ preview });
  });

  app.post("/v1/portal/catalog/import", async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({
        error: "missing_file",
        message: "Envie o arquivo CSV no campo file",
      });
    }

    const filename = file.filename.toLowerCase();
    if (!filename.endsWith(".csv") && !filename.endsWith(".txt")) {
      return reply.status(400).send({
        error: "invalid_file",
        message: "Use arquivo CSV (.csv)",
      });
    }

    const query = request.query as {
      itemCodeKey?: string;
      titleKey?: string;
      activeKey?: string;
      mode?: string;
    };

    const mode = query.mode === "merge" ? "merge" : "replace";

    const buffer = await file.toBuffer();
    const result = await importCatalogCsv(app.db, buffer, {
      filename: file.filename,
      itemCodeKey: query.itemCodeKey?.trim(),
      titleKey: query.titleKey?.trim() || null,
      activeKey: query.activeKey?.trim() || null,
      mode,
    });

    if (result.error === "no_rows") {
      return reply.status(400).send({
        error: "no_rows",
        message: "CSV vazio ou sem linhas de dados",
      });
    }

    return reply.send({ ok: true, ...result });
  });

  app.get("/v1/portal/catalog/export", async (_request, reply) => {
    const csv = await exportCatalogAsCsv(app.db);
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header(
        "Content-Disposition",
        'attachment; filename="catalogo.csv"',
      )
      .send(csv);
  });

  app.get("/v1/portal/conversations", async (request, reply) => {
    const query = request.query as {
      limit?: string;
      offset?: string;
      search?: string;
    };
    const result = await listConversations(app.db, {
      limit: query.limit ? Number(query.limit) : 40,
      offset: query.offset ? Number(query.offset) : 0,
      search: query.search,
    });
    return reply.send(result);
  });

  app.get("/v1/portal/conversations/:phone", async (request, reply) => {
    const phone = (request.params as { phone: string }).phone;
    if (!phone?.replace(/\D/g, "")) {
      return reply.status(400).send({ error: "invalid_phone" });
    }
    const thread = await getConversationThread(app.db, app.redis, phone, {
      limit: 300,
    });
    return reply.send(thread);
  });

  app.patch("/v1/portal/conversations/:phone/mode", async (request, reply) => {
    const phone = (request.params as { phone: string }).phone.replace(/\D/g, "");
    if (!phone) {
      return reply.status(400).send({ error: "invalid_phone" });
    }
    const parsed = conversationModeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }
    await setConversationMode(app.db, phone, parsed.data.mode, {
      reason: parsed.data.reason ?? "portal_manual",
    });
    return reply.send({ ok: true, phone, mode: parsed.data.mode });
  });

  app.post(
    "/v1/portal/conversations/:phone/reset",
    { preHandler: requirePortalRole(["installer"]) },
    async (request, reply) => {
      const phone = (request.params as { phone: string }).phone.replace(
        /\D/g,
        "",
      );
      if (!phone) {
        return reply.status(400).send({ error: "invalid_phone" });
      }
      const body = z
        .object({ cancelAppointments: z.boolean().optional() })
        .safeParse(request.body ?? {});
      const result = await resetConversationForPhone(
        app.db,
        app.redis,
        phone,
        { cancelAppointments: body.data?.cancelAppointments },
      );
      return reply.send({ ok: true, phone, ...result });
    },
  );

  app.get("/v1/portal/contacts", async (request, reply) => {
    const query = request.query as {
      limit?: string;
      offset?: string;
      search?: string;
    };
    const result = await listPortalContacts(app.db, {
      limit: query.limit ? Number(query.limit) : 50,
      offset: query.offset ? Number(query.offset) : 0,
      search: query.search,
    });
    return reply.send(result);
  });

  app.get("/v1/portal/system", async (_request, reply) => {
    const system = await getSystemOverview(app.config, app.db);
    return reply.send({ system });
  });

  app.get("/v1/portal/whatsapp/status", async (_request, reply) => {
    const status = await getWhatsAppStatus(app.config.evolution);
    return reply.send({ whatsapp: status });
  });

  app.post("/v1/portal/whatsapp/connect", async (_request, reply) => {
    try {
      const result = await connectWhatsApp(app.config.evolution);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "connect_failed";
      return reply.status(502).send({ error: "evolution_error", message });
    }
  });

  app.post(
    "/v1/portal/whatsapp/disconnect",
    { preHandler: requirePortalRole(["installer"]) },
    async (_request, reply) => {
      try {
        await disconnectWhatsApp(app.config.evolution);
        const status = await getWhatsAppStatus(app.config.evolution);
        return reply.send({ ok: true, whatsapp: status });
      } catch (err) {
        const message = err instanceof Error ? err.message : "disconnect_failed";
        return reply.status(502).send({ error: "evolution_error", message });
      }
    },
  );

  app.get("/v1/portal/ops/failed-messages", async (request, reply) => {
    const query = request.query as { limit?: string; all?: string };
    const items = await listFailedMessages(app.db, {
      limit: query.limit ? Number(query.limit) : 50,
      unresolvedOnly: query.all !== "true",
    });
    return reply.send({ items });
  });

  app.patch(
    "/v1/portal/ops/failed-messages/:id/resolve",
    { preHandler: requirePortalRole(["installer"]) },
    async (request, reply) => {
      const id = Number((request.params as { id: string }).id);
      if (!Number.isInteger(id) || id <= 0) {
        return reply.status(400).send({ error: "invalid_id" });
      }
      const ok = await resolveFailedMessage(app.db, id);
      if (!ok) return reply.status(404).send({ error: "not_found" });
      return reply.send({ ok: true });
    },
  );

  app.get("/v1/portal/dashboard", async (_request, reply) => {
    let propertiesActive = 0;
    let appointmentsUpcoming = 0;
    let failedMessages = 0;
    let contactsTotal = 0;
    let conversationsTotal = 0;

    try {
      const catalog = await getCatalogStats(app.db);
      propertiesActive = catalog.active;
      const appts = await listAppointments(app.db, {
        status: "scheduled" as AppointmentStatus,
        from: new Date().toISOString(),
        limit: 200,
      });
      appointmentsUpcoming = appts.length;

      const failed = await app.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM app.failed_messages WHERE resolved_at IS NULL`,
      );
      failedMessages = Number(failed.rows[0]?.count ?? 0);

      const contacts = await app.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM app.contacts`,
      );
      contactsTotal = Number(contacts.rows[0]?.count ?? 0);

      const convs = await app.db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM app.conversation_state`,
      );
      conversationsTotal = Number(convs.rows[0]?.count ?? 0);
    } catch {
      /* dashboard parcial ok */
    }

    const health = await getDashboardHealthSummary(app.config, app.db, {
      catalogActive: propertiesActive,
      failedMessages,
    });

    return reply.send({
      brand: {
        name: brand.brandName,
        slug: brand.brandSlug,
        assistantName: brand.assistantName,
        website: brand.brandWebsite ?? null,
        primaryColor: brand.brandPrimaryColor ?? null,
        logoUrl: brand.brandLogoUrl ?? null,
      },
      features,
      catalog: { propertiesActive },
      scheduling: { appointmentsUpcoming },
      crm: { contactsTotal, conversationsTotal },
      ops: { failedMessagesUnresolved: failedMessages },
      health,
    });
  });

  app.get("/v1/portal/scheduling/settings", async (_request, reply) => {
    const settings = await getSchedulingSettings(app.db);
    return reply.send(settings);
  });

  app.patch(
    "/v1/portal/scheduling/settings",
    async (request, reply) => {
      const parsed = settingsPatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "validation_error",
          details: parsed.error.flatten(),
        });
      }

      const body = parsed.data;
      const settings = await updateSchedulingSettings(app.db, {
        ...body,
        mapsUrl:
          body.mapsUrl === "" ? null : (body.mapsUrl ?? undefined),
      });
      return reply.send(settings);
    },
  );

  app.get("/v1/portal/scheduling/appointments", async (request, reply) => {
    const query = request.query as {
      status?: AppointmentStatus;
      from?: string;
      to?: string;
      limit?: string;
    };
    const appointments = await listAppointments(app.db, {
      status: query.status,
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : 50,
    });
    return reply.send({ appointments });
  });

  app.get("/v1/portal/scheduling/blackouts", async (_request, reply) => {
    const { rows } = await app.db.query<{
      id: number;
      starts_at: Date;
      ends_at: Date;
      label: string | null;
    }>(
      `SELECT id, starts_at, ends_at, label
       FROM app.scheduling_blackouts
       ORDER BY starts_at ASC
       LIMIT 100`,
    );
    return reply.send({
      blackouts: rows.map((r) => ({
        id: r.id,
        startsAt: r.starts_at.toISOString(),
        endsAt: r.ends_at.toISOString(),
        label: r.label,
      })),
    });
  });

  app.post("/v1/portal/scheduling/blackouts", async (request, reply) => {
    const parsed = blackoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }

    const { rows } = await app.db.query<{ id: number }>(
      `INSERT INTO app.scheduling_blackouts (starts_at, ends_at, label)
       VALUES ($1::timestamptz, $2::timestamptz, $3)
       RETURNING id`,
      [parsed.data.startsAt, parsed.data.endsAt, parsed.data.label ?? null],
    );

    return reply.send({ ok: true, id: rows[0]?.id });
  });

  app.delete("/v1/portal/scheduling/blackouts/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.status(400).send({ error: "invalid_id" });
    }
    await app.db.query(`DELETE FROM app.scheduling_blackouts WHERE id = $1`, [
      id,
    ]);
    return reply.send({ ok: true });
  });

  app.get("/v1/portal/agent-config", async (_request, reply) => {
    const config = await getAgentConfig(app.db);
    return reply.send({ config });
  });

  app.patch("/v1/portal/agent-config", async (request, reply) => {
    const parsed = agentPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }

    const config = await updateAgentConfig(app.db, parsed.data);
    return reply.send({ config });
  });

  app.get("/v1/portal/agent-config/preview", async (_request, reply) => {
    const config = await getAgentConfig(app.db);
    return reply.send({
      block: formatAgentConfigPromptBlock(config),
    });
  });

  app.post(
    "/v1/portal/users",
    { preHandler: requirePortalRole(["installer"]) },
    async (request, reply) => {
      const parsed = createUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "validation_error",
          details: parsed.error.flatten(),
        });
      }

      try {
        const user = await createPortalUser(app.db, {
          ...parsed.data,
          role: "client",
        });
        return reply.send({ user });
      } catch (err: unknown) {
        const code =
          err && typeof err === "object" && "code" in err
            ? String((err as { code: string }).code)
            : "";
        if (code === "23505") {
          return reply.status(409).send({ error: "email_in_use" });
        }
        throw err;
      }
    },
  );
}
