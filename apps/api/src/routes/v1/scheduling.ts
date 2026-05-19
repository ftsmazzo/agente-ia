import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  bookAppointment,
  buildAppointmentIcs,
  getAppointment,
  getSchedulingSettings,
  listAppointments,
  listAvailableSlots,
  updateAppointment,
  type AppointmentStatus,
} from "../../services/scheduling-service.js";

const appointmentStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);

const bookBodySchema = z.object({
  phone: z.string().min(8).max(32),
  startsAt: z.string().datetime(),
  customerName: z.string().max(255).optional(),
  propertyCode: z.string().max(16).optional(),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const appointmentConfirmationSchema = z.enum([
  "pending",
  "confirmed",
  "declined",
]);

const patchBodySchema = z.object({
  status: appointmentStatusSchema.optional(),
  confirmationStatus: appointmentConfirmationSchema.optional(),
  startsAt: z.string().datetime().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function schedulingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/scheduling/settings", async (_request, reply) => {
    const settings = await getSchedulingSettings(app.db);
    return reply.send(settings);
  });

  app.get("/v1/scheduling/slots", async (request, reply) => {
    const query = request.query as { days?: string; limit?: string };
    const slots = await listAvailableSlots(app.db, {
      days: query.days ? Number(query.days) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    });
    return reply.send({ slots });
  });

  app.post("/v1/scheduling/book", async (request, reply) => {
    const parsed = bookBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    const result = await bookAppointment(app.db, {
      phone: body.phone.replace(/\D/g, ""),
      startsAt: body.startsAt,
      customerName: body.customerName,
      propertyCode: body.propertyCode?.toUpperCase(),
      notes: body.notes,
      metadata: body.metadata,
    });

    if (!result.ok) {
      return reply.status(409).send({
        error: result.reason,
        slots: result.slots.slice(0, 5),
      });
    }

    return reply.send({ ok: true, appointment: result.appointment });
  });

  app.get("/v1/scheduling/appointments", async (request, reply) => {
    const query = request.query as {
      status?: AppointmentStatus;
      from?: string;
      to?: string;
      limit?: string;
    };
    const status = appointmentStatusSchema.safeParse(query.status);
    if (query.status && !status.success) {
      return reply.status(400).send({ error: "invalid_status" });
    }

    const appointments = await listAppointments(app.db, {
      status: status.success ? status.data : undefined,
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
    });
    return reply.send({ appointments });
  });

  app.patch("/v1/scheduling/appointments/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.status(400).send({ error: "invalid_id" });
    }

    const parsed = patchBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "validation_error",
        details: parsed.error.flatten(),
      });
    }

    const result = await updateAppointment(app.db, id, parsed.data);
    if (!result.ok) {
      return reply.status(409).send({
        error: result.reason,
        slots: result.slots.slice(0, 5),
      });
    }
    if (!result.appointment) return reply.status(404).send({ error: "not_found" });

    return reply.send({ ok: true, appointment: result.appointment });
  });

  app.get("/v1/scheduling/appointments/:id/ics", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.status(400).send({ error: "invalid_id" });
    }

    const appointment = await getAppointment(app.db, id);
    if (!appointment) return reply.status(404).send({ error: "not_found" });

    return reply
      .header(
        "Content-Disposition",
        `attachment; filename="visita-${appointment.id}.ics"`,
      )
      .type("text/calendar; charset=utf-8")
      .send(buildAppointmentIcs(appointment));
  });
}
