import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  api,
  type Appointment,
  type Blackout,
  type SchedulingSettings,
} from "../api.js";

const WEEKDAYS = [
  { v: 0, l: "Dom" },
  { v: 1, l: "Seg" },
  { v: 2, l: "Ter" },
  { v: 3, l: "Qua" },
  { v: 4, l: "Qui" },
  { v: 5, l: "Sex" },
  { v: 6, l: "Sáb" },
];

type AppointmentView = "upcoming" | "pending_confirmation" | "past";

const CONFIRMATION_LABEL: Record<Appointment["confirmationStatus"], string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  declined: "Recusado",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Visita confirmada",
  cancelled: "Cancelado",
  completed: "Realizado",
  no_show: "Não compareceu",
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgendaPage() {
  const [settings, setSettings] = useState<SchedulingSettings | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptView, setApptView] = useState<AppointmentView>("upcoming");
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [blackoutStart, setBlackoutStart] = useState("");
  const [blackoutEnd, setBlackoutEnd] = useState("");
  const [blackoutLabel, setBlackoutLabel] = useState("");

  const loadAppointments = useCallback(async (view: AppointmentView) => {
    setLoadingAppts(true);
    try {
      if (view === "pending_confirmation") {
        const { appointments: list } = await api.getAppointments({
          upcoming: true,
          confirmationStatus: "pending",
          limit: 100,
        });
        setAppointments(list);
      } else if (view === "past") {
        const { appointments: list } = await api.getAppointments({
          past: true,
          limit: 50,
        });
        setAppointments(list);
      } else {
        const { appointments: list } = await api.getAppointments({
          upcoming: true,
          limit: 100,
        });
        setAppointments(list);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar agendamentos");
    } finally {
      setLoadingAppts(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([api.getScheduling(), api.getBlackouts()])
      .then(([s, b]) => {
        setSettings(s);
        setBlackouts(b.blackouts);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, []);

  useEffect(() => {
    void loadAppointments(apptView);
  }, [apptView, loadAppointments]);

  async function patchAppointment(
    id: number,
    patch: Parameters<typeof api.patchAppointment>[1],
  ) {
    setError("");
    try {
      const { appointment } = await api.patchAppointment(id, patch);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? appointment : a)),
      );
      setMessage("Agendamento atualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    }
  }

  function toggleWeekday(day: number) {
    if (!settings) return;
    const weekdays = settings.weekdays.includes(day)
      ? settings.weekdays.filter((d) => d !== day)
      : [...settings.weekdays, day].sort((a, b) => a - b);
    setSettings({ ...settings, weekdays });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const updated = await api.patchScheduling(settings);
      setSettings(updated);
      setMessage("Agenda salva com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <p>Carregando…</p>;

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Agenda</h1>
      <p style={{ color: "var(--muted)" }}>
        Horários oferecidos no WhatsApp, visitas agendadas e confirmação
        operacional (lembrete automático ~24h antes).
      </p>

      {message && <p style={{ color: "#6bcf8e" }}>{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>Agendamentos</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 0 }}>
          Confirme visitas após o lembrete no WhatsApp. Alertas de erro do
          sistema também podem ser enviados ao mesmo número configurado no n8n.
        </p>

        <div className="agenda-tabs" role="tablist">
          {(
            [
              ["upcoming", "Próximos"],
              ["pending_confirmation", "Pendentes confirmação"],
              ["past", "Passados"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              className={`btn btn-ghost${apptView === key ? " active" : ""}`}
              aria-selected={apptView === key}
              onClick={() => setApptView(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {loadingAppts ? (
          <p style={{ color: "var(--muted)" }}>Carregando agendamentos…</p>
        ) : appointments.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Nenhum agendamento nesta lista.
          </p>
        ) : (
          <ul className="item-list">
            {appointments.map((a) => (
              <li key={a.id} className="item-list-row">
                <div>
                  <strong>{formatWhen(a.startsAt)}</strong>
                  <p className="item-meta" style={{ margin: "0.25rem 0" }}>
                    {a.customerName ?? a.phone}
                    {a.propertyCode ? ` · ${a.propertyCode}` : ""}
                  </p>
                  <p className="item-meta" style={{ margin: 0 }}>
                    {STATUS_LABEL[a.status] ?? a.status}
                    {" · "}
                    <span
                      style={{
                        color:
                          a.confirmationStatus === "pending"
                            ? "#e8c547"
                            : a.confirmationStatus === "confirmed"
                              ? "#6bcf8e"
                              : "var(--muted)",
                      }}
                    >
                      {CONFIRMATION_LABEL[a.confirmationStatus]}
                    </span>
                    {a.reminder24hSentAt ? " · lembrete enviado" : ""}
                    {a.location ? ` · ${a.location}` : ""}
                  </p>
                </div>
                {apptView !== "past" && a.status !== "cancelled" && (
                  <div
                    className="row-actions"
                    style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                  >
                    {a.confirmationStatus !== "confirmed" && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() =>
                          void patchAppointment(a.id, {
                            confirmationStatus: "confirmed",
                            status: "confirmed",
                          })
                        }
                      >
                        Confirmar visita
                      </button>
                    )}
                    {a.confirmationStatus === "pending" && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() =>
                          void patchAppointment(a.id, {
                            confirmationStatus: "declined",
                          })
                        }
                      >
                        Recusar
                      </button>
                    )}
                    {a.status !== "cancelled" && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() =>
                          void patchAppointment(a.id, { status: "cancelled" })
                        }
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={onSubmit} className="card">
        <h2>Horário comercial</h2>

        <div className="row">
          <div>
            <label>Início</label>
            <input
              type="time"
              value={settings.workStart.slice(0, 5)}
              onChange={(e) =>
                setSettings({ ...settings, workStart: `${e.target.value}:00` })
              }
            />
          </div>
          <div>
            <label>Fim</label>
            <input
              type="time"
              value={settings.workEnd.slice(0, 5)}
              onChange={(e) =>
                setSettings({ ...settings, workEnd: `${e.target.value}:00` })
              }
            />
          </div>
        </div>

        <label>Dias da semana</label>
        <div className="checks" style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {WEEKDAYS.map((d) => (
            <label key={d.v}>
              <input
                type="checkbox"
                checked={settings.weekdays.includes(d.v)}
                onChange={() => toggleWeekday(d.v)}
              />
              {d.l}
            </label>
          ))}
        </div>

        <div className="row">
          <div>
            <label>Duração do agendamento (min)</label>
            <input
              type="number"
              min={15}
              max={240}
              value={settings.durationMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  durationMinutes: Number(e.target.value),
                })
              }
            />
          </div>
          <div>
            <label>Antecedência mínima (min)</label>
            <input
              type="number"
              min={0}
              value={settings.minNoticeMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  minNoticeMinutes: Number(e.target.value),
                })
              }
            />
          </div>
        </div>

        <label>Local (texto para o cliente)</label>
        <input
          value={settings.location}
          onChange={(e) =>
            setSettings({ ...settings, location: e.target.value })
          }
        />

        <label>Endereço completo</label>
        <input
          value={settings.address ?? ""}
          onChange={(e) =>
            setSettings({ ...settings, address: e.target.value || null })
          }
        />

        <label>Link Google Maps</label>
        <input
          value={settings.mapsUrl ?? ""}
          onChange={(e) =>
            setSettings({ ...settings, mapsUrl: e.target.value || null })
          }
        />

        <label>
          <input
            type="checkbox"
            checked={settings.active}
            onChange={(e) =>
              setSettings({ ...settings, active: e.target.checked })
            }
            style={{ width: "auto", marginRight: "0.5rem" }}
          />
          Agenda ativa
        </label>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Salvando…" : "Salvar agenda"}
        </button>
      </form>

      <div className="card">
        <h2>Bloqueios (feriados / folga)</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Períodos em que nenhum horário será oferecido.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!blackoutStart || !blackoutEnd) return;
            try {
              await api.addBlackout({
                startsAt: new Date(blackoutStart).toISOString(),
                endsAt: new Date(blackoutEnd).toISOString(),
                label: blackoutLabel || undefined,
              });
              const { blackouts: list } = await api.getBlackouts();
              setBlackouts(list);
              setBlackoutStart("");
              setBlackoutEnd("");
              setBlackoutLabel("");
              setMessage("Bloqueio adicionado.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erro");
            }
          }}
        >
          <div className="row">
            <div>
              <label>Início</label>
              <input
                type="datetime-local"
                value={blackoutStart}
                onChange={(e) => setBlackoutStart(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Fim</label>
              <input
                type="datetime-local"
                value={blackoutEnd}
                onChange={(e) => setBlackoutEnd(e.target.value)}
                required
              />
            </div>
          </div>
          <label>Descrição (opcional)</label>
          <input
            value={blackoutLabel}
            onChange={(e) => setBlackoutLabel(e.target.value)}
            placeholder="Feriado, recesso…"
          />
          <button type="submit" className="btn btn-ghost">
            Adicionar bloqueio
          </button>
        </form>
        {blackouts.length > 0 && (
          <ul className="item-list" style={{ marginTop: "1rem" }}>
            {blackouts.map((b) => (
              <li key={b.id} className="item-list-row">
                <div>
                  <strong>
                    {new Date(b.startsAt).toLocaleString("pt-BR")} →{" "}
                    {new Date(b.endsAt).toLocaleString("pt-BR")}
                  </strong>
                  {b.label && <p className="item-meta">{b.label}</p>}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={async () => {
                    await api.deleteBlackout(b.id);
                    setBlackouts((prev) => prev.filter((x) => x.id !== b.id));
                  }}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
