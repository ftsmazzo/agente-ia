declare global {
  interface Window {
    __PORTAL_API_URL__?: string;
  }
}

/** Painel em HTTPS não pode chamar API em HTTP (Mixed Content bloqueado pelo browser). */
function normalizeApiBase(raw: string): string {
  let base = raw.trim().replace(/\/$/, "");
  if (!base) return "";

  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    base.startsWith("http://")
  ) {
    base = `https://${base.slice("http://".length)}`;
  }
  return base;
}

function resolveApiBase(): string {
  const fromRuntime = window.__PORTAL_API_URL__?.trim() ?? "";
  const fromBuild = import.meta.env.VITE_API_URL?.trim() ?? "";
  return normalizeApiBase(fromRuntime || fromBuild);
}

const API_BASE = resolveApiBase();

export function getApiBaseUrl(): string {
  return API_BASE;
}

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
  crm: { contactsTotal: number; conversationsTotal: number };
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

export type CatalogStats = {
  total: number;
  active: number;
  lastImportedAt: string | null;
  columns: Array<{ key: string; label: string }>;
  itemCodeKey: string | null;
  titleKey: string | null;
  activeKey: string | null;
  sourceFilename: string | null;
};

export type CatalogPreview = {
  columns: Array<{ key: string; label: string; inferredType: string }>;
  delimiter: string;
  rowCount: number;
  itemCodeKey: string;
  titleKey: string | null;
  activeKey: string | null;
  sample: Array<{
    itemCode: string;
    title: string | null;
    active: boolean;
    fields: Record<string, string>;
  }>;
};

export type Appointment = {
  id: number;
  phone: string;
  customerName: string | null;
  propertyCode: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  location: string;
};

export type Blackout = {
  id: number;
  startsAt: string;
  endsAt: string;
  label: string | null;
};

export type FailedMessage = {
  id: number;
  externalId: string | null;
  phone: string | null;
  errorMessage: string;
  retryCount: number;
  createdAt: string;
  payloadPreview: string;
};

export type ConversationSummary = {
  phone: string;
  displayName: string | null;
  mode: "bot" | "human" | "paused";
  lastMessageAt: string | null;
  preview: string | null;
};

export type ConversationEvent = {
  id: number;
  direction: "inbound" | "outbound";
  status: string;
  workflowStep: string;
  text: string | null;
  reason: string | null;
  createdAt: string;
};

export type ConversationThread = {
  phone: string;
  displayName: string | null;
  mode: "bot" | "human" | "paused";
  events: ConversationEvent[];
  redisHistory: Array<{ role: "user" | "assistant"; content: string }>;
};

export type ContactSummary = {
  phone: string;
  displayName: string | null;
  updatedAt: string;
  propertyCode: string | null;
  leadStatus: string | null;
  qualification: {
    budgetMaxBrl: number | null;
    payment: string | null;
    buyingWith: string | null;
    timelineHint: string | null;
    visitRequested: boolean;
    incomeHint: string | null;
  } | null;
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
  if (!API_BASE) {
    throw new Error(
      "API não configurada. No EasyPanel, serviço portal: defina PORTAL_API_URL=https://sua-api (Environment, não só Build Arg).",
    );
  }

  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const t = token();
  if (t) headers.set("Authorization", `Bearer ${t}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      `Não foi possível conectar à API (${API_BASE}). Confira: API online, PORTAL_API_URL no portal e PORTAL_CORS_ORIGIN na API = URL exata do painel (https://...).`,
    );
  }

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
  patchAgentConfig(
    body: Partial<AgentConfig> & {
      objectives?: AgentConfig["objectives"];
    },
  ) {
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
  getCatalog() {
    return request<{ catalog: CatalogStats }>("/v1/portal/catalog");
  },
  previewCatalog(file: File) {
    const form = new FormData();
    form.append("file", file);
    return request<{ preview: CatalogPreview }>(
      "/v1/portal/catalog/preview",
      { method: "POST", body: form },
    );
  },
  importCatalog(
    file: File,
    opts: {
      itemCodeKey: string;
      titleKey?: string;
      activeKey?: string;
      mode?: "replace" | "merge";
    },
  ) {
    const form = new FormData();
    form.append("file", file);
    const q = new URLSearchParams();
    q.set("itemCodeKey", opts.itemCodeKey);
    q.set("mode", opts.mode ?? "replace");
    if (opts.titleKey) q.set("titleKey", opts.titleKey);
    if (opts.activeKey) q.set("activeKey", opts.activeKey);
    return request<{
      ok: boolean;
      upserted: number;
      activeCount: number;
      total: number;
      mode: string;
      columns: Array<{ key: string; label: string }>;
    }>(`/v1/portal/catalog/import?${q}`, { method: "POST", body: form });
  },
  async downloadCatalogCsv(): Promise<void> {
    if (!API_BASE) throw new Error("API não configurada");
    const t = token();
    const res = await fetch(`${API_BASE}/v1/portal/catalog/export`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!res.ok) throw new Error("Falha ao exportar");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalogo.csv";
    a.click();
    URL.revokeObjectURL(url);
  },
  getAppointments(params?: { status?: string; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<{ appointments: Appointment[] }>(
      `/v1/portal/scheduling/appointments${qs ? `?${qs}` : ""}`,
    );
  },
  getBlackouts() {
    return request<{ blackouts: Blackout[] }>(
      "/v1/portal/scheduling/blackouts",
    );
  },
  addBlackout(body: { startsAt: string; endsAt: string; label?: string }) {
    return request<{ ok: boolean; id: number }>(
      "/v1/portal/scheduling/blackouts",
      { method: "POST", body: JSON.stringify(body) },
    );
  },
  deleteBlackout(id: number) {
    return request<{ ok: boolean }>(
      `/v1/portal/scheduling/blackouts/${id}`,
      { method: "DELETE" },
    );
  },
  getConversations(params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<{ items: ConversationSummary[]; total: number }>(
      `/v1/portal/conversations${qs ? `?${qs}` : ""}`,
    );
  },
  getConversation(phone: string) {
    const encoded = encodeURIComponent(phone.replace(/\D/g, ""));
    return request<ConversationThread>(`/v1/portal/conversations/${encoded}`);
  },
  setConversationMode(phone: string, mode: "bot" | "human" | "paused") {
    const encoded = encodeURIComponent(phone.replace(/\D/g, ""));
    return request<{ ok: boolean; phone: string; mode: string }>(
      `/v1/portal/conversations/${encoded}/mode`,
      {
        method: "PATCH",
        body: JSON.stringify({ mode, reason: "portal_manual" }),
      },
    );
  },
  resetConversation(phone: string) {
    const encoded = encodeURIComponent(phone.replace(/\D/g, ""));
    return request<{
      ok: boolean;
      phone: string;
      redisKeysDeleted: number;
      appointmentsCancelled: number;
    }>(`/v1/portal/conversations/${encoded}/reset`, {
      method: "POST",
      body: JSON.stringify({ cancelAppointments: true }),
    });
  },
  getContacts(params?: { search?: string; limit?: number; offset?: number }) {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<{ items: ContactSummary[]; total: number }>(
      `/v1/portal/contacts${qs ? `?${qs}` : ""}`,
    );
  },
  getFailedMessages() {
    return request<{ items: FailedMessage[] }>(
      "/v1/portal/ops/failed-messages",
    );
  },
  resolveFailedMessage(id: number) {
    return request<{ ok: boolean }>(
      `/v1/portal/ops/failed-messages/${id}/resolve`,
      { method: "PATCH" },
    );
  },
};
