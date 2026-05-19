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
  health: {
    overall: "ok" | "warn" | "error";
    version: string;
    whatsapp: {
      status: "connected" | "connecting" | "disconnected" | "unknown";
      phone: string | null;
    };
    alerts: string[];
  };
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
  slotCapacity: number;
  location: string;
  address: string | null;
  mapsUrl: string | null;
  active: boolean;
};

export type AgentConfig = {
  productId: string;
  vertical: string;
  companyProfile: string;
  tone: string;
  objectives: { schedule: boolean; capture: boolean; qualify: boolean };
  capabilities: string[];
  customRules: string;
};

export type CapabilityInstallRow = {
  id: string;
  label: string;
  enabledInPortal: boolean;
  installed: boolean;
  status: "ok" | "warn" | "error";
  detail: string;
  workflows: string[];
  envApi: string[];
  envN8n: string[];
};

export type ProductAgentesIa = {
  product: { id: string; name: string; description: string };
  capabilities: Array<{
    id: string;
    label: string;
    description: string;
    enabled: boolean;
    requires: string[];
    workflows: string[];
  }>;
  install: CapabilityInstallRow[];
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
  confirmationStatus: "pending" | "confirmed" | "declined";
  confirmedAt: string | null;
  reminder24hSentAt: string | null;
  startsAt: string;
  endsAt: string;
  location: string;
  notes?: string | null;
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

export type WhatsAppStatus = {
  configured: boolean;
  instanceName: string | null;
  status: "connected" | "connecting" | "disconnected" | "unknown";
  stateRaw: string | null;
  phone: string | null;
  profileName: string | null;
  profilePictureUrl: string | null;
  webhookUrl: string | null;
  integration: string | null;
  error: string | null;
};

export type ChecklistItem = {
  id: string;
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
};

export type SystemOverview = {
  version: string;
  overall: "ok" | "warn" | "error";
  checks: { database: boolean; redis: boolean };
  whatsapp: WhatsAppStatus;
  llm: { enabled: boolean; provider: string; model: string };
  rag: { enabled: boolean };
  catalogActive: number;
  failedMessages: number;
  checklist: ChecklistItem[];
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

  const method = (options.method ?? "GET").toUpperCase();
  let body = options.body;
  const headers = new Headers(options.headers);
  if (!(body instanceof FormData)) {
    if (body == null && ["POST", "PUT", "PATCH"].includes(method)) {
      body = "{}";
    }
    if (body != null) {
      headers.set("Content-Type", "application/json");
    }
  }
  const t = token();
  if (t) headers.set("Authorization", `Bearer ${t}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      body,
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
    if (data.error === "validation_error" && data.details?.fieldErrors) {
      const fields = Object.entries(
        data.details.fieldErrors as Record<string, string[]>,
      )
        .map(([k, v]) => `${k}: ${v.join(", ")}`)
        .join("; ");
      throw new Error(fields || "Dados inválidos");
    }
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
  getSystem() {
    return request<{ system: SystemOverview }>("/v1/portal/system");
  },
  getScheduling() {
    return request<SchedulingSettings>("/v1/portal/scheduling/settings");
  },
  patchScheduling(body: Partial<SchedulingSettings>) {
    const payload = { ...body };
    if (payload.workStart) {
      payload.workStart = payload.workStart.slice(0, 5);
    }
    if (payload.workEnd) {
      payload.workEnd = payload.workEnd.slice(0, 5);
    }
    if (payload.mapsUrl === "") {
      payload.mapsUrl = null;
    }
    return request<SchedulingSettings>("/v1/portal/scheduling/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
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
  getProductAgentesIa() {
    return request<ProductAgentesIa>("/v1/portal/product/agentes-ia");
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
  getAppointments(params?: {
    status?: string;
    confirmationStatus?: string;
    upcoming?: boolean;
    past?: boolean;
    limit?: number;
  }) {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.confirmationStatus) {
      q.set("confirmationStatus", params.confirmationStatus);
    }
    if (params?.upcoming) q.set("upcoming", "1");
    if (params?.past) q.set("past", "1");
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<{ appointments: Appointment[] }>(
      `/v1/portal/scheduling/appointments${qs ? `?${qs}` : ""}`,
    );
  },
  patchAppointment(
    id: number,
    body: {
      status?: string;
      confirmationStatus?: "pending" | "confirmed" | "declined";
      notes?: string | null;
    },
  ) {
    return request<{ ok: boolean; appointment: Appointment }>(
      `/v1/portal/scheduling/appointments/${id}`,
      { method: "PATCH", body: JSON.stringify(body) },
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
  getWhatsAppStatus() {
    return request<{ whatsapp: WhatsAppStatus }>("/v1/portal/whatsapp/status");
  },
  connectWhatsApp() {
    return request<{
      ok: boolean;
      qrCodeDataUrl: string | null;
      pairingCode: string | null;
      message: string | null;
    }>("/v1/portal/whatsapp/connect", { method: "POST" });
  },
  disconnectWhatsApp() {
    return request<{ ok: boolean; whatsapp: WhatsAppStatus }>(
      "/v1/portal/whatsapp/disconnect",
      { method: "POST" },
    );
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
