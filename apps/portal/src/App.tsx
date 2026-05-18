import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { isLoggedIn } from "./api.js";
import { Layout } from "./Layout.js";
import { AgentPage } from "./pages/AgentPage.js";
import { AgendaPage } from "./pages/AgendaPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { LoginPage } from "./pages/LoginPage.js";
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
        <Route path="agente" element={<AgentPage />} />
        <Route path="equipe" element={<TeamPage />} />
      </Route>
    </Routes>
  );
}
