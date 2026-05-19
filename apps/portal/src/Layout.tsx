import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api, setToken, type PortalUser } from "./api.js";

export function Layout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<PortalUser | null>(null);

  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => navigate("/login"));
  }, [navigate]);

  function logout() {
    setToken(null);
    navigate("/login");
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Portal</h1>
        <NavLink to="/" end>
          Início
        </NavLink>
        <NavLink to="/agenda">Agenda</NavLink>
        <NavLink to="/catalogo">Catálogo</NavLink>
        <NavLink to="/agente">Agente</NavLink>
        <NavLink to="/whatsapp">WhatsApp</NavLink>
        <NavLink to="/contatos">Contatos</NavLink>
        <NavLink to="/conversas">Conversas</NavLink>
        <NavLink to="/monitor">Monitor</NavLink>
        {user?.role === "installer" && (
          <>
            <NavLink to="/instalacao">Instalação</NavLink>
            <NavLink to="/sistema">Sistema</NavLink>
            <NavLink to="/equipe">Equipe</NavLink>
          </>
        )}
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost" onClick={logout}>
          Sair
        </button>
      </aside>
      <main className="main">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
