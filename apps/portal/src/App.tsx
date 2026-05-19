import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { isLoggedIn } from "./api.js";
import { Layout } from "./Layout.js";
import { AgentPage } from "./pages/AgentPage.js";
import { AgendaPage } from "./pages/AgendaPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { CatalogPage } from "./pages/CatalogPage.js";
import { MonitorPage } from "./pages/MonitorPage.js";
import { ConversationsPage } from "./pages/ConversationsPage.js";
import { ContactsPage } from "./pages/ContactsPage.js";
import { WhatsAppPage } from "./pages/WhatsAppPage.js";
import { SystemPage } from "./pages/SystemPage.js";
import { TeamPage } from "./pages/TeamPage.js";

function PrivateRoute({ children }: { children: ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="catalogo" element={<CatalogPage />} />
        <Route path="agente" element={<AgentPage />} />
        <Route path="monitor" element={<MonitorPage />} />
        <Route path="conversas" element={<ConversationsPage />} />
        <Route path="contatos" element={<ContactsPage />} />
        <Route path="whatsapp" element={<WhatsAppPage />} />
        <Route path="sistema" element={<SystemPage />} />
        <Route path="equipe" element={<TeamPage />} />
      </Route>
    </Routes>
  );
}
