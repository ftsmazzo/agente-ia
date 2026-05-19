import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Dashboard } from "../api.js";

export function DashboardPage() {
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

  return (
    <>
      <h1 style={{ marginTop: 0 }}>{data.brand.name}</h1>
      <p style={{ color: "var(--muted)", marginTop: "-0.5rem" }}>
        Assistente: <strong>{data.brand.assistantName}</strong>
      </p>

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
        </ul>
      </div>
    </>
  );
}
