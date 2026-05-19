import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LoadingState } from "../components/LoadingState.js";
import { PageHeader } from "../components/PageHeader.js";
import { api, type InstallGuide } from "../api.js";

function badgeClass(status: "ok" | "warn" | "error"): string {
  if (status === "ok") return "sys-badge sys-ok";
  if (status === "warn") return "sys-badge sys-warn";
  return "sys-badge sys-error";
}

function overallTitle(overall: InstallGuide["overall"]): string {
  if (overall === "ok") return "Pronto para testes de ponta a ponta";
  if (overall === "warn") return "Instalação incompleta — revise itens abaixo";
  return "Corrija erros críticos na API";
}

export function InstallPage() {
  const [guide, setGuide] = useState<InstallGuide | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [n8nBase, setN8nBase] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [openTemplate, setOpenTemplate] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { guide: g } = await api.getInstallGuide();
      setGuide(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function copyText(label: string, text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (!guide && !error) {
    return <LoadingState label="Carregando guia de instalação…" />;
  }

  return (
    <>
      <PageHeader
        title="Instalação"
        description={
          <>
            Pacote <strong>{guide?.product.name ?? "agentes-ia"}</strong> —
            checklist para nova empresa. O portal não cria serviços no EasyPanel
            automaticamente; use isto enquanto configura cada serviço.
          </>
        }
        actions={
          guide ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? "Atualizando…" : "Atualizar diagnóstico"}
            </button>
          ) : undefined
        }
      />

      {error && <p className="error">{error}</p>}

      {guide && (
        <>
          <div
            className={`card ${
              guide.overall === "ok"
                ? "sys-overall-ok"
                : guide.overall === "warn"
                  ? "sys-overall-warn"
                  : "sys-overall-error"
            }`}
          >
            <h2 style={{ marginTop: 0 }}>{overallTitle(guide.overall)}</h2>
            <p className="item-meta">
              Versão API {guide.version} · Repositório:{" "}
              <code>{guide.docs.fullGuide}</code>
            </p>
          </div>

          <div className="card">
            <h2>Templates .env (copiar para o EasyPanel)</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              Cole no Environment de cada serviço e preencha os valores vazios.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {guide.envTemplateFiles.map((tpl) => (
                <li
                  key={tpl.id}
                  style={{
                    marginBottom: "0.75rem",
                    paddingBottom: "0.75rem",
                    borderBottom: "1px solid var(--surface2)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                      alignItems: "center",
                    }}
                  >
                    <strong>{tpl.label}</strong>
                    <code style={{ fontSize: "0.85rem" }}>{tpl.path}</code>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!tpl.content}
                      onClick={() => copyText(tpl.id, tpl.content)}
                    >
                      {copied === tpl.id ? "Copiado!" : "Copiar .env"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        setOpenTemplate((id) =>
                          id === tpl.id ? null : tpl.id,
                        )
                      }
                    >
                      {openTemplate === tpl.id ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                  {!tpl.content && (
                    <p className="item-meta" style={{ margin: "0.35rem 0 0" }}>
                      Template não encontrado no servidor — use o arquivo no
                      repositório.
                    </p>
                  )}
                  {openTemplate === tpl.id && tpl.content && (
                    <pre
                      style={{
                        marginTop: "0.5rem",
                        padding: "0.75rem",
                        overflow: "auto",
                        fontSize: "0.75rem",
                        maxHeight: 280,
                        background: "var(--surface2)",
                        borderRadius: 8,
                      }}
                    >
                      {tpl.content}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2>Env na API (este servidor)</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              Conferido em runtime. Variáveis do n8n devem ser validadas no
              painel do n8n.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {guide.serverEnv.map((row) => (
                <li
                  key={row.key}
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span className={badgeClass(row.ok ? "ok" : "warn")}>
                    {row.ok ? "OK" : "Falta"}
                  </span>
                  <span>
                    <strong>{row.key}</strong>
                    <br />
                    <span className="item-meta">{row.hint}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2>Funções do agente</h2>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {guide.capabilities.map((cap) => (
                <li key={cap.id} style={{ marginBottom: "0.75rem" }}>
                  <span className={badgeClass(cap.status)}>{cap.label}</span>
                  <p className="item-meta" style={{ margin: "0.25rem 0 0" }}>
                    {cap.detail}
                  </p>
                </li>
              ))}
            </ul>
            <Link to="/agente">Ajustar funções no Agente →</Link>
          </div>

          <div className="card">
            <h2>Passo a passo</h2>
            {guide.phases.map((phase) => (
              <div key={phase.id} style={{ marginBottom: "1.25rem" }}>
                <h3 style={{ marginBottom: "0.35rem" }}>{phase.title}</h3>
                <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
                  {phase.steps.map((step, i) => (
                    <li key={i} style={{ marginBottom: "0.25rem" }}>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Workflows n8n</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              Import: n8n → Workflows → Import from File →{" "}
              <code>n8n/workflows/</code> → Activate
            </p>
            <label>URL base do n8n (para montar webhooks)</label>
            <input
              placeholder="https://n8n.suaempresa.com"
              value={n8nBase}
              onChange={(e) => setN8nBase(e.target.value.replace(/\/$/, ""))}
              style={{ marginBottom: "1rem", width: "100%", maxWidth: 480 }}
            />
            <table style={{ width: "100%", fontSize: "0.9rem" }}>
              <thead>
                <tr>
                  <th align="left">Arquivo</th>
                  <th align="left">Webhook</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {guide.workflows.map((w) => {
                  const fullUrl =
                    w.webhook && n8nBase ? `${n8nBase}${w.webhook}` : null;
                  return (
                    <tr key={w.file}>
                      <td>
                        <code>{w.file}</code>
                        {!w.required && (
                          <span className="item-meta"> (opcional)</span>
                        )}
                        <br />
                        <span className="item-meta">{w.label}</span>
                      </td>
                      <td>
                        {w.webhook ? (
                          <code>{fullUrl ?? w.webhook}</code>
                        ) : (
                          <span className="item-meta">Cron 30 min</span>
                        )}
                      </td>
                      <td>
                        {fullUrl && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => copyText(w.file, fullUrl)}
                          >
                            {copied === w.file ? "Copiado" : "Copiar URL"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Variáveis que devem bater</h2>
            <table style={{ width: "100%", fontSize: "0.9rem" }}>
              <thead>
                <tr>
                  <th align="left">API</th>
                  <th align="left">n8n</th>
                  <th align="left">Nota</th>
                </tr>
              </thead>
              <tbody>
                {guide.envSync.map((row) => (
                  <tr key={row.label}>
                    <td>
                      <code>{row.apiVar ?? "—"}</code>
                    </td>
                    <td>
                      <code>{row.n8nVar ?? "—"}</code>
                    </td>
                    <td className="item-meta">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--muted)" }}>
              Templates: <code>{guide.envTemplates.api}</code>,{" "}
              <code>{guide.envTemplates.n8n}</code>,{" "}
              <code>{guide.envTemplates.evolution}</code>
            </p>
          </div>

          <p style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
            Após configurar: <Link to="/whatsapp">WhatsApp</Link> ·{" "}
            <Link to="/sistema">Sistema</Link> · teste conversa real.
          </p>
        </>
      )}
    </>
  );
}
