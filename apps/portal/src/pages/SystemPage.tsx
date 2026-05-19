import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ChecklistItem, type SystemOverview } from "../api.js";

function statusLabel(status: ChecklistItem["status"]): string {
  if (status === "ok") return "OK";
  if (status === "warn") return "Atenção";
  return "Erro";
}

function statusClass(status: ChecklistItem["status"]): string {
  if (status === "ok") return "sys-badge sys-ok";
  if (status === "warn") return "sys-badge sys-warn";
  return "sys-badge sys-error";
}

function overallClass(overall: SystemOverview["overall"]): string {
  if (overall === "ok") return "sys-overall sys-overall-ok";
  if (overall === "warn") return "sys-overall sys-overall-warn";
  return "sys-overall sys-overall-error";
}

export function SystemPage() {
  const [system, setSystem] = useState<SystemOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { system: s } = await api.getSystem();
      setSystem(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Sistema</h1>
      <p style={{ color: "var(--muted)" }}>
        Saúde desta instalação — use antes de liberar para o cliente ou após
        redeploy.
      </p>

      {error && <p className="error">{error}</p>}

      {!system ? (
        <p style={{ color: "var(--muted)" }}>Carregando…</p>
      ) : (
        <>
          <div className={`card ${overallClass(system.overall)}`}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>
                  {system.overall === "ok"
                    ? "Instalação saudável"
                    : system.overall === "warn"
                      ? "Atenção necessária"
                      : "Corrija antes de produção"}
                </h2>
                <p className="item-meta" style={{ margin: "0.35rem 0 0" }}>
                  Versão {system.version} · LLM{" "}
                  {system.llm.enabled ? "ativo" : "inativo"} · RAG{" "}
                  {system.rag.enabled ? "ativo" : "inativo"}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={loading}
                onClick={refresh}
              >
                {loading ? "Atualizando…" : "Atualizar"}
              </button>
            </div>
          </div>

          <div className="card">
            <h2>Checklist</h2>
            <ul className="sys-list">
              {system.checklist.map((item) => (
                <li key={item.id} className="sys-list-row">
                  <div>
                    <strong>{item.label}</strong>
                    <p className="item-meta">{item.detail}</p>
                  </div>
                  <span className={statusClass(item.status)}>
                    {statusLabel(item.status)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2>Ações rápidas</h2>
            <ul
              style={{
                margin: 0,
                paddingLeft: "1.2rem",
                color: "var(--muted)",
              }}
            >
              {system.whatsapp.status !== "connected" && (
                <li>
                  <Link to="/whatsapp">WhatsApp</Link> — reconectar sessão
                </li>
              )}
              {system.catalogActive === 0 && (
                <li>
                  <Link to="/catalogo">Catálogo</Link> — importar CSV
                </li>
              )}
              {system.failedMessages > 0 && (
                <li>
                  <Link to="/monitor">Monitor</Link> —{" "}
                  {system.failedMessages} falha(s)
                </li>
              )}
              <li>
                <Link to="/agente">Agente</Link> — tom e perfil da empresa
              </li>
            </ul>
          </div>
        </>
      )}

      <p style={{ fontSize: "0.9rem", marginTop: "1rem" }}>
        <Link to="/">← Início</Link>
      </p>
    </>
  );
}
