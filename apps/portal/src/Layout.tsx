import { AnimatePresence } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PageTransition } from "./components/PageTransition.js";
import {
  IconActivity,
  IconBot,
  IconCalendar,
  IconChat,
  IconGrid,
  IconHome,
  IconLogout,
  IconServer,
  IconTeam,
  IconUsers,
  IconWhatsApp,
  IconWrench,
} from "./components/NavIcons.js";
import { api, setToken, type PortalUser } from "./api.js";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  installerOnly?: boolean;
};

const NAV_MAIN: NavItem[] = [
  { to: "/", label: "Início", icon: <IconHome />, end: true },
  { to: "/agenda", label: "Agenda", icon: <IconCalendar /> },
  { to: "/catalogo", label: "Catálogo", icon: <IconGrid /> },
  { to: "/agente", label: "Agente", icon: <IconBot /> },
  { to: "/whatsapp", label: "WhatsApp", icon: <IconWhatsApp /> },
  { to: "/contatos", label: "Contatos", icon: <IconUsers /> },
  { to: "/conversas", label: "Conversas", icon: <IconChat /> },
  { to: "/monitor", label: "Monitor", icon: <IconActivity /> },
];

const NAV_INSTALLER: NavItem[] = [
  { to: "/instalacao", label: "Instalação", icon: <IconWrench />, installerOnly: true },
  { to: "/sistema", label: "Sistema", icon: <IconServer />, installerOnly: true },
  { to: "/equipe", label: "Equipe", icon: <IconTeam />, installerOnly: true },
];

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<PortalUser | null>(null);

  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => navigate("/login"));
  }, [navigate]);

  function logout() {
    setToken(null);
    navigate("/login");
  }

  const isInstaller = user?.role === "installer";

  function renderNav(items: NavItem[]) {
    return items
      .filter((item) => !item.installerOnly || isInstaller)
      .map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end}>
          {item.icon}
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ));
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo" aria-hidden>
            IA
          </div>
          <div className="sidebar-brand-text">
            <h1>Agentes IA</h1>
            <span>Painel operacional</span>
          </div>
        </div>

        <div className="sidebar-section">Operação</div>
        {renderNav(NAV_MAIN)}

        {isInstaller && (
          <>
            <div className="sidebar-section">Administração</div>
            {renderNav(NAV_INSTALLER)}
          </>
        )}

        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user">
              <strong>{user.name}</strong>
              {user.email}
              <span style={{ display: "block", marginTop: "0.2rem", opacity: 0.7 }}>
                {isInstaller ? "Instalador" : "Cliente"}
              </span>
            </div>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: "100%" }}
            onClick={logout}
          >
            <IconLogout />
            <span className="nav-label">Sair</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet context={{ user }} />
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
}
