import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api, type FailedMessage, type PortalUser } from "../api.js";

export function MonitorPage() {
  const { user } = useOutletContext<{ user: PortalUser | null }>();
  const [items, setItems] = useState<FailedMessage[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const { items: list } = await api.getFailedMessages();
    setItems(list);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, []);

  async function resolve(id: number) {
    try {
      await api.resolveFailedMessage(id);
      setMessage("Marcado como resolvido.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Monitor</h1>
      <p style={{ color: "var(--muted)" }}>
        Mensagens que falharam no processamento (n8n ou API).
      </p>

      {message && <p style={{ color: "#6bcf8e" }}>{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="card">
        {items.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Nenhuma falha pendente.
          </p>
        ) : (
          <ul className="item-list">
            {items.map((item) => (
              <li key={item.id} className="item-list-row">
                <div>
                  <strong>
                    {item.phone ?? "sem telefone"} ·{" "}
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </strong>
                  <p className="item-meta">{item.errorMessage}</p>
                  {item.payloadPreview && (
                    <p className="item-meta">{item.payloadPreview}</p>
                  )}
                </div>
                {user?.role === "installer" && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => resolve(item.id)}
                  >
                    Resolver
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p style={{ fontSize: "0.9rem" }}>
        <Link to="/">← Voltar ao início</Link>
      </p>
    </>
  );
}
