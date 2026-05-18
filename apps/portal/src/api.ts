const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

export type PortalUser = {
  id: number;
  email: string;
  name: string;
  role: "installer" | "client";
};

export type Dashboard = {
  brand: {
    name: string;
    assistantName: string;
    primaryColor: string | null;
  };
  catalog: { propertiesActive: number };
  scheduling: { appointmentsUpcoming: number };
  ops: { failedMessagesUnresolved: number };
};

export type SchedulingSettings = {
  timezone: string;
  weekdays: number[];
  workStart: string;
  workEnd: string;
  slotMinutes: number;
  durationMinutes: number;
  minNoticeMinutes: number;
  horizonDays: number;
  location: string;
  address: string | null;
  mapsUrl: string | null;
  active: boolean;
};

export type AgentConfig = {
  vertical: string;
  companyProfile: string;
  tone: string;
  objectives: { schedule: boolean; capture: boolean; qualify: boolean };
  customRules: string;
};

function token(): string | null {
  return localStorage.getItem("portal_token");
}

export function setToken(value: string | null): void {
  if (value) localStorage.setItem("portal_token", value);
  else localStorage.removeItem("portal_token");
}

export function isLoggedIn(): boolean {
  return Boolean(token());
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const t = token();
  if (t) headers.set("Authorization", `Bearer ${t}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    setToken(null);
    window.location.href = "/login";
    throw new Error("Sessão expirada");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data.message === "string"
        ? data.message
        : data.error ?? "Erro na requisição";
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  login(email: string, password: string) {
    return request<{ token: string; user: PortalUser }>(
      "/v1/portal/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
  },
  me() {
    return request<{ user: PortalUser }>("/v1/portal/auth/me");
  },
  dashboard() {
    return request<Dashboard>("/v1/portal/dashboard");
  },
  getScheduling() {
    return request<SchedulingSettings>("/v1/portal/scheduling/settings");
  },
  patchScheduling(body: Partial<SchedulingSettings>) {
    return request<SchedulingSettings>("/v1/portal/scheduling/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  getAgentConfig() {
    return request<{ config: AgentConfig }>("/v1/portal/agent-config");
  },
  patchAgentConfig(body: Partial<AgentConfig> & { objectives?: AgentConfig["objectives"] }) {
    return request<{ config: AgentConfig }>("/v1/portal/agent-config", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  createClientUser(body: { email: string; password: string; name: string }) {
    return request<{ user: PortalUser }>("/v1/portal/users", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
