import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type ContactSummary } from "../api.js";

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) {
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  return phone;
}

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function statusLabel(status: string | null): string {
  if (!status) return "—";
  if (status === "visit_scheduled") return "Agendamento confirmado";
  if (status === "qualification") return "Em qualificação";
  return status;
}

export function ContactsPage() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<ContactSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  async function load(q?: string) {
    const { items: list, total: t } = await api.getContacts({
      search: q,
      limit: 80,
    });
    setItems(list);
    setTotal(t);
  }

  useEffect(() => {
    const q = searchParams.get("search")?.trim();
    if (q) {
      setSearch(q);
      setQuery(q);
      load(q).catch((e) => setError(e instanceof Error ? e.message : "Erro"));
    } else {
      load().catch((e) => setError(e instanceof Error ? e.message : "Erro"));
    }
  }, [searchParams]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setQuery(search);
    load(search.trim() || undefined).catch((err) =>
      setError(err instanceof Error ? err.message : "Erro"),
    );
  }

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Contatos</h1>
      <p style={{ color: "var(--muted)" }}>
        Cadastro automático pelo WhatsApp — nome, interesse no catálogo e dados de
        qualificação extraídos da conversa.
      </p>

      {error && <p className="error">{error}</p>}

      <form
        onSubmit={onSearch}
        className="card"
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div style={{ flex: 1, minWidth: "200px" }}>
          <label>Buscar</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou telefone"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Buscar
        </button>
      </form>

      <div className="card">
        <p
          style={{
            margin: "0 0 1rem",
            color: "var(--muted)",
            fontSize: "0.9rem",
          }}
        >
          {total} contato(s){query ? ` · “${query}”` : ""}
        </p>
        {items.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Nenhum contato ainda.
          </p>
        ) : (
          <ul className="item-list">
            {items.map((item) => (
              <li key={item.phone} className="item-list-row">
                <div>
                  <strong>
                    <Link to={`/conversas?phone=${encodeURIComponent(item.phone)}`}>
                      {item.displayName ?? formatPhone(item.phone)}
                    </Link>
                  </strong>
                  {item.displayName && (
                    <p className="item-meta">{formatPhone(item.phone)}</p>
                  )}
                  <p className="item-meta">
                    {statusLabel(item.leadStatus)}
                    {item.propertyCode ? ` · ${item.propertyCode}` : ""}
                  </p>
                  {item.qualification && (
                    <p className="item-meta">
                      {item.qualification.budgetMaxBrl != null &&
                        `Até ${formatBrl(item.qualification.budgetMaxBrl)}`}
                      {item.qualification.payment &&
                        ` · ${item.qualification.payment}`}
                      {item.qualification.visitRequested && " · quer agendar"}
                    </p>
                  )}
                  <p className="item-meta" style={{ fontSize: "0.8rem" }}>
                    Atualizado{" "}
                    {new Date(item.updatedAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p style={{ fontSize: "0.9rem" }}>
        <Link to="/">← Início</Link>
      </p>
    </>
  );
}
