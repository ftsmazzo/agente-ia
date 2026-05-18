import { useEffect, useState } from "react";
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
            <strong>{data.scheduling.appointmentsUpcoming}</strong>
            <span>Visitas agendadas</span>
          </div>
          <div className="stat">
            <strong>{data.ops.failedMessagesUnresolved}</strong>
            <span>Falhas pendentes</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Próximos passos</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--muted)" }}>
          <li>
            Ajuste horários em <a href="/agenda">Agenda</a>
          </li>
          <li>
            Personalize tom e empresa em <a href="/agente">Agente</a>
          </li>
        </ul>
      </div>
    </>
  );
}
