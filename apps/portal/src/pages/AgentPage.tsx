import { FormEvent, useEffect, useState } from "react";
import { api, type AgentConfig } from "../api.js";

const TONES = [
  { value: "professional_warm", label: "Profissional e acolhedor" },
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Descontraído" },
  { value: "enthusiastic", label: "Entusiasmado" },
];

export function AgentPage() {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getAgentConfig()
      .then((r) => setConfig(r.config))
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const { config: updated } = await api.patchAgentConfig(config);
      setConfig(updated);
      setMessage("Agente atualizado. Novas conversas já usam estas regras.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (!config) return <p>Carregando…</p>;

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Personalizar agente</h1>
      <p style={{ color: "var(--muted)" }}>
        A base técnica é mantida pela plataforma; aqui você define tom, empresa e
        objetivos.
      </p>

      {message && <p style={{ color: "#6bcf8e" }}>{message}</p>}
      {error && <p className="error">{error}</p>}

      <form onSubmit={onSubmit} className="card">
        <h2>Sobre a empresa</h2>
        <label>Texto para a IA entender o negócio</label>
        <textarea
          value={config.companyProfile}
          onChange={(e) =>
            setConfig({ ...config, companyProfile: e.target.value })
          }
          placeholder="História, diferenciais, região de atuação, público-alvo…"
        />

        <h2>Tom de voz</h2>
        <select
          value={config.tone}
          onChange={(e) => setConfig({ ...config, tone: e.target.value })}
        >
          {TONES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <h2>Objetivos</h2>
        <div className="checks">
          <label>
            <input
              type="checkbox"
              checked={config.objectives.capture}
              onChange={(e) =>
                setConfig({
                  ...config,
                  objectives: {
                    ...config.objectives,
                    capture: e.target.checked,
                  },
                })
              }
            />
            Captar interesse e contato
          </label>
          <label>
            <input
              type="checkbox"
              checked={config.objectives.qualify}
              onChange={(e) =>
                setConfig({
                  ...config,
                  objectives: {
                    ...config.objectives,
                    qualify: e.target.checked,
                  },
                })
              }
            />
            Qualificar perfil e necessidade
          </label>
          <label>
            <input
              type="checkbox"
              checked={config.objectives.schedule}
              onChange={(e) =>
                setConfig({
                  ...config,
                  objectives: {
                    ...config.objectives,
                    schedule: e.target.checked,
                  },
                })
              }
            />
            Agendar visita ou reunião
          </label>
        </div>

        <h2>Regras adicionais</h2>
        <label>O que a IA deve ou não fazer neste cliente</label>
        <textarea
          value={config.customRules}
          onChange={(e) =>
            setConfig({ ...config, customRules: e.target.value })
          }
          placeholder="Ex.: não falar de financiamento antes da visita; sempre citar a unidade do centro…"
        />

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Salvando…" : "Salvar agente"}
        </button>
      </form>
    </>
  );
}
