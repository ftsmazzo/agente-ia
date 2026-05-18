import { FormEvent, useEffect, useState } from "react";
import { api, type SchedulingSettings } from "../api.js";

const WEEKDAYS = [
  { v: 0, l: "Dom" },
  { v: 1, l: "Seg" },
  { v: 2, l: "Ter" },
  { v: 3, l: "Qua" },
  { v: 4, l: "Qui" },
  { v: 5, l: "Sex" },
  { v: 6, l: "Sáb" },
];

export function AgendaPage() {
  const [settings, setSettings] = useState<SchedulingSettings | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getScheduling()
      .then(setSettings)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, []);

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
        Horários que o assistente pode oferecer no WhatsApp.
      </p>

      {message && <p style={{ color: "#6bcf8e" }}>{message}</p>}
      {error && <p className="error">{error}</p>}

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
            <label>Duração da visita (min)</label>
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
    </>
  );
}
