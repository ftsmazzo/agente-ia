import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type ConversationEvent,
  type ConversationSummary,
  type ConversationThread,
} from "../api.js";

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) {
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  return phone;
}

function modeLabel(mode: string): string {
  if (mode === "human") return "Corretor";
  if (mode === "paused") return "Pausado";
  return "Bot";
}

function EventBubble({ event }: { event: ConversationEvent }) {
  const inbound = event.direction === "inbound";
  if (event.text) {
    return (
      <div
        className={`chat-bubble ${inbound ? "chat-in" : "chat-out"}`}
      >
        <p className="chat-text">{event.text}</p>
        <time className="chat-time">
          {new Date(event.createdAt).toLocaleString("pt-BR")}
        </time>
      </div>
    );
  }
  return (
    <div className="chat-system">
      <span>
        {inbound ? "Cliente" : "Sistema"}
        {event.reason ? ` · ${event.reason}` : ""} ·{" "}
        {event.status}
      </span>
      <time>{new Date(event.createdAt).toLocaleString("pt-BR")}</time>
    </div>
  );
}

export function ConversationsPage() {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<ConversationThread | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadList(q?: string) {
    const { items: list, total: t } = await api.getConversations({
      search: q,
      limit: 50,
    });
    setItems(list);
    setTotal(t);
  }

  async function loadThread(phone: string) {
    setLoading(true);
    setError("");
    try {
      const data = await api.getConversation(phone);
      setThread(data);
      setSelected(phone);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList().catch((e) =>
      setError(e instanceof Error ? e.message : "Erro"),
    );
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setQuery(search);
    loadList(search.trim() || undefined).catch((err) =>
      setError(err instanceof Error ? err.message : "Erro"),
    );
  }

  function backToList() {
    setSelected(null);
    setThread(null);
  }

  const showRedis =
    thread &&
    thread.redisHistory.length > 0 &&
    thread.events.filter((e) => e.text).length < thread.redisHistory.length;

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Conversas</h1>
      <p style={{ color: "var(--muted)" }}>
        Histórico gravado na API (WhatsApp via n8n). Mensagens novas incluem
        texto; eventos antigos podem aparecer só como registro de sistema.
      </p>

      {error && <p className="error">{error}</p>}

      {!selected ? (
        <>
          <form onSubmit={onSearch} className="card" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <label>Buscar por nome ou telefone</label>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Maria ou 5516..."
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Buscar
            </button>
          </form>

          <div className="card">
            <p style={{ margin: "0 0 1rem", color: "var(--muted)", fontSize: "0.9rem" }}>
              {total} conversa(s){query ? ` · filtro: “${query}”` : ""}
            </p>
            {items.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>
                Nenhuma conversa ainda.
              </p>
            ) : (
              <ul className="item-list">
                {items.map((item) => (
                  <li key={item.phone} className="item-list-row">
                    <button
                      type="button"
                      className="conv-row-btn"
                      onClick={() => loadThread(item.phone)}
                    >
                      <strong>
                        {item.displayName ?? formatPhone(item.phone)}
                      </strong>
                      <span className="conv-mode">{modeLabel(item.mode)}</span>
                      {item.displayName && (
                        <p className="item-meta">{formatPhone(item.phone)}</p>
                      )}
                      {item.preview && (
                        <p className="item-meta conv-preview">{item.preview}</p>
                      )}
                      {item.lastMessageAt && (
                        <p className="item-meta">
                          {new Date(item.lastMessageAt).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        thread && (
          <div className="card conv-thread">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={backToList}
              style={{ marginBottom: "1rem" }}
            >
              ← Voltar
            </button>
            <header className="conv-header">
              <div>
                <h2 style={{ margin: 0 }}>
                  {thread.displayName ?? formatPhone(thread.phone)}
                </h2>
                <p className="item-meta">{formatPhone(thread.phone)}</p>
              </div>
              <span className="conv-mode">{modeLabel(thread.mode)}</span>
            </header>

            {loading ? (
              <p style={{ color: "var(--muted)" }}>Carregando…</p>
            ) : (
              <div className="chat-log">
                {thread.events.length === 0 && !showRedis && (
                  <p style={{ color: "var(--muted)" }}>
                    Sem eventos registrados para este número.
                  </p>
                )}
                {thread.events.map((event) => (
                  <EventBubble key={event.id} event={event} />
                ))}
                {showRedis && (
                  <>
                    <p className="chat-divider">
                      Memória do agente (Redis, últimos 7 dias)
                    </p>
                    {thread.redisHistory.map((turn, i) => (
                      <div
                        key={`redis-${i}`}
                        className={`chat-bubble ${turn.role === "user" ? "chat-in" : "chat-out"}`}
                      >
                        <p className="chat-text">{turn.content}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )
      )}

      <p style={{ fontSize: "0.9rem" }}>
        <Link to="/">← Início</Link>
      </p>
    </>
  );
}
