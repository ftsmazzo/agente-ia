import { FormEvent, useEffect, useState } from "react";
import {
  api,
  type AgentConfig,
  type ProductAgentesIa,
} from "../api.js";

const TONES = [
  { value: "professional_warm", label: "Profissional e acolhedor" },
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Descontraído" },
  { value: "enthusiastic", label: "Entusiasmado" },
];

function toggleCapability(config: AgentConfig, id: string, on: boolean): AgentConfig {
  const set = new Set(config.capabilities);
  if (on) set.add(id);
  else set.delete(id);
  if (id === "scheduling" && !on) set.delete("visit-reminders");
  if (id === "visit-reminders" && on) set.add("scheduling");
  const capabilities = [...set];
  return {
    ...config,
    capabilities,
    objectives: {
      ...config.objectives,
      schedule: capabilities.includes("scheduling"),
    },
  };
}

export function AgentPage() {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [product, setProduct] = useState<ProductAgentesIa | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.getAgentConfig(), api.getProductAgentesIa()])
      .then(([agent, pkg]) => {
        setConfig(agent.config);
        setProduct(pkg);
      })
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
      const pkg = await api.getProductAgentesIa();
      setProduct(pkg);
      setMessage("Agente atualizado. Novas conversas já usam estas regras.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (!config || !product) return <p>Carregando…</p>;

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Personalizar agente</h1>
      <p style={{ color: "var(--muted)" }}>
        Pacote <strong>{product.product.name}</strong> — ligue funções para
        montar o comportamento da IA. A infra (n8n, env) segue o guia de
        instalação.
      </p>

      {message && <p style={{ color: "#6bcf8e" }}>{message}</p>}
      {error && <p className="error">{error}</p>}

      <form onSubmit={onSubmit} className="card">
        <h2>Funções do pacote</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Cada função adiciona um bloco ao prompt interno. Status = env +
          workflows no servidor.
        </p>
        <div className="checks">
          {product.capabilities.map((cap) => {
            const install = product.install.find((i) => i.id === cap.id);
            return (
              <div key={cap.id} style={{ marginBottom: 12 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={config.capabilities.includes(cap.id)}
                    onChange={(e) =>
                      setConfig(toggleCapability(config, cap.id, e.target.checked))
                    }
                  />
                  <strong>{cap.label}</strong>
                </label>
                <p
                  style={{
                    margin: "4px 0 0 1.6rem",
                    fontSize: "0.85rem",
                    color: "var(--muted)",
                  }}
                >
                  {cap.description}
                  {cap.workflows.length > 0 && (
                    <>
                      {" "}
                      · n8n: {cap.workflows.join(", ")}
                    </>
                  )}
                </p>
                {install && install.enabledInPortal && install.status !== "ok" && (
                  <p
                    style={{
                      margin: "4px 0 0 1.6rem",
                      fontSize: "0.85rem",
                      color: "#e8b86d",
                    }}
                  >
                    {install.detail}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>

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
              disabled={!config.capabilities.includes("scheduling")}
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
            Oferecer agendamento (requer função Agenda)
          </label>
        </div>

        <h2>Regras adicionais</h2>
        <label>O que a IA deve ou não fazer neste cliente</label>
        <textarea
          value={config.customRules}
          onChange={(e) =>
            setConfig({ ...config, customRules: e.target.value })
          }
          placeholder="Ex.: não falar de preço antes de qualificar; sempre citar o código do item…"
        />

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Salvando…" : "Salvar agente"}
        </button>
      </form>

      <p style={{ marginTop: 16, fontSize: "0.85rem", color: "var(--muted)" }}>
        Guia de instalação:{" "}
        <code>docs/product-agentes-ia.md</code> no repositório.
      </p>
    </>
  );
}
