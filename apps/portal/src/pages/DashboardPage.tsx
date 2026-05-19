import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api, type Dashboard, type PortalUser } from "../api.js";

function waLabel(status: Dashboard["health"]["whatsapp"]["status"]): string {
  if (status === "connected") return "Conectado";
  if (status === "connecting") return "Conectando…";
  if (status === "disconnected") return "Desconectado";
  return "Indefinido";
}

export function DashboardPage() {
  const { user } = useOutletContext<{ user: PortalUser | null }>();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .dashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Carregando…</p>;

  const h = data.health;
  const showBanner = h.overall !== "ok";

  return (
    <>
      <h1 style={{ marginTop: 0 }}>{data.brand.name}</h1>
      <p style={{ color: "var(--muted)", marginTop: "-0.5rem" }}>
        Assistente: <strong>{data.brand.assistantName}</strong>
        <span style={{ marginLeft: "0.75rem", fontSize: "0.85rem" }}>
          v{h.version}
        </span>
      </p>

      {showBanner && (
        <div
          className={`card dash-alert dash-alert-${h.overall}`}
          style={{ marginBottom: "1.25rem" }}
        >
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>
            {h.overall === "error"
              ? "Ação necessária"
              : "Revise antes de usar em produção"}
          </h2>
          <ul
            style={{
              margin: "0 0 0.75rem",
              paddingLeft: "1.2rem",
              color: "var(--muted)",
              fontSize: "0.9rem",
            }}
          >
            {h.alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            WhatsApp: <strong>{waLabel(h.whatsapp.status)}</strong>
            {h.whatsapp.phone ? ` · ${h.whatsapp.phone}` : ""}
            {" · "}
            <Link to="/whatsapp">Abrir WhatsApp</Link>
            {user?.role === "installer" && (
              <>
                {" · "}
                <Link to="/sistema">Checklist completo</Link>
              </>
            )}
          </p>
        </div>
      )}

      {!showBanner && h.whatsapp.status === "connected" && (
        <p
          style={{
            color: "#6bcf8e",
            fontSize: "0.9rem",
            margin: "0 0 1rem",
          }}
        >
          WhatsApp conectado
          {h.whatsapp.phone ? ` · ${h.whatsapp.phone}` : ""}
        </p>
      )}

      <div className="card">
        <h2>Resumo</h2>
        <div className="stats">
          <div className="stat">
            <strong>{data.catalog.propertiesActive}</strong>
            <span>Itens no catálogo</span>
          </div>
          <div className="stat">
            <strong>{data.crm.contactsTotal}</strong>
            <span>Contatos</span>
          </div>
          <div className="stat">
            <strong>{data.scheduling.appointmentsUpcoming}</strong>
            <span>Agendamentos</span>
          </div>
          <div className="stat">
            <strong>{data.ops.failedMessagesUnresolved}</strong>
            <span>Falhas pendentes</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Atalhos</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--muted)" }}>
          <li>
            <Link to="/whatsapp">WhatsApp</Link> — status e reconectar (QR)
          </li>
          <li>
            <Link to="/contatos">Contatos</Link> — CRM automático do WhatsApp
          </li>
          <li>
            <Link to="/conversas">Conversas</Link> — histórico e modo bot/usuário
          </li>
          <li>
            <Link to="/agenda">Agenda</Link> — horários e agendamentos
          </li>
          <li>
            <Link to="/catalogo">Catálogo</Link> — importar CSV
          </li>
          <li>
            <Link to="/agente">Agente</Link> — tom e empresa
          </li>
          {data.ops.failedMessagesUnresolved > 0 && (
            <li>
              <Link to="/monitor">
                {data.ops.failedMessagesUnresolved} falha(s) pendente(s)
              </Link>
            </li>
          )}
          {user?.role === "installer" && (
            <li>
              <Link to="/sistema">Sistema</Link> — checklist da instalação
            </li>
          )}
        </ul>
      </div>
    </>
  );
}
