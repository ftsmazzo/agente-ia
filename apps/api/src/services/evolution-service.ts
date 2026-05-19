import type { EvolutionSettings } from "../config/evolution-config.js";

export type WhatsAppConnectionStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "unknown";

export type WhatsAppStatus = {
  configured: boolean;
  instanceName: string | null;
  status: WhatsAppConnectionStatus;
  stateRaw: string | null;
  phone: string | null;
  profileName: string | null;
  profilePictureUrl: string | null;
  webhookUrl: string | null;
  integration: string | null;
  error: string | null;
};

export type WhatsAppConnectResult = {
  qrCodeDataUrl: string | null;
  pairingCode: string | null;
  message: string | null;
};

type InstanceRow = {
  instanceName: string;
  owner?: string;
  profileName?: string;
  profilePictureUrl?: string | null;
  status?: string;
  integration?: string;
};

function parseOwnerPhone(...sources: Array<string | undefined>): string | null {
  for (const raw of sources) {
    if (!raw) continue;
    const digits = raw.split("@")[0]?.replace(/\D/g, "");
    if (digits && digits.length >= 10) return digits;
  }
  return null;
}

function mapState(state: string | undefined): WhatsAppConnectionStatus {
  const s = (state ?? "").toLowerCase().trim();
  if (
    s === "open" ||
    s === "connected" ||
    s === "online" ||
    s === "ready" ||
    s === "authenticated"
  ) {
    return "connected";
  }
  if (s === "connecting" || s === "pairing" || s === "qrcode") {
    return "connecting";
  }
  if (
    s === "close" ||
    s === "closed" ||
    s === "disconnected" ||
    s === "offline" ||
    s === "logout"
  ) {
    return "disconnected";
  }
  return "unknown";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Extrai estado de conexão de qualquer formato Evolution v1/v2. */
function extractState(payload: unknown): string | null {
  const visit = (obj: unknown, depth = 0): string | null => {
    if (depth > 4 || obj == null) return null;
    const rec = asRecord(obj);
    if (!rec) return null;

    for (const key of [
      "state",
      "status",
      "connectionStatus",
      "connectionState",
      "instanceStatus",
    ]) {
      const val = rec[key];
      if (typeof val === "string" && val.trim()) return val.trim();
    }

    if (rec.instance) {
      const nested = visit(rec.instance, depth + 1);
      if (nested) return nested;
    }
    if (rec.data) {
      const nested = visit(rec.data, depth + 1);
      if (nested) return nested;
    }

    return null;
  };

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const s = visit(item, 0);
      if (s) return s;
    }
    return null;
  }

  return visit(payload, 0);
}

function normalizeInstanceRow(raw: Record<string, unknown>): InstanceRow {
  const integration = raw.integration;
  let integrationLabel: string | undefined;
  if (typeof integration === "string") {
    integrationLabel = integration;
  } else if (integration && typeof integration === "object") {
    const i = integration as Record<string, unknown>;
    integrationLabel =
      typeof i.integration === "string"
        ? i.integration
        : typeof i.channel === "string"
          ? i.channel
          : undefined;
  }

  const name = String(
    raw.instanceName ?? raw.name ?? raw.instance ?? "",
  ).trim();

  const status = String(
    raw.status ??
      raw.state ??
      raw.connectionStatus ??
      raw.connectionState ??
      "",
  ).trim();

  return {
    instanceName: name,
    owner: String(
      raw.owner ??
        raw.ownerJid ??
        raw.wuid ??
        raw.number ??
        raw.phone ??
        "",
    ),
    profileName:
      typeof raw.profileName === "string"
        ? raw.profileName
        : typeof raw.pushName === "string"
          ? raw.pushName
          : undefined,
    profilePictureUrl:
      typeof raw.profilePictureUrl === "string"
        ? raw.profilePictureUrl
        : typeof raw.profilePicUrl === "string"
          ? raw.profilePicUrl
          : null,
    status: status || undefined,
    integration: integrationLabel,
  };
}

function extractInstances(payload: unknown): InstanceRow[] {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    const rows: InstanceRow[] = [];
    for (const item of payload) {
      const rec = asRecord(item);
      if (!rec) continue;
      if (rec.instance) {
        const inner = asRecord(rec.instance);
        if (inner) rows.push(normalizeInstanceRow(inner));
      } else {
        rows.push(normalizeInstanceRow(rec));
      }
    }
    return rows.filter((r) => r.instanceName);
  }

  const root = asRecord(payload);
  if (!root) return [];

  if (Array.isArray(root.response)) {
    return extractInstances(root.response);
  }
  if (Array.isArray(root.data)) {
    return extractInstances(root.data);
  }

  if (root.instance) {
    const inner = asRecord(root.instance);
    if (inner) return [normalizeInstanceRow(inner)];
  }

  if (typeof root.instanceName === "string" || typeof root.name === "string") {
    return [normalizeInstanceRow(root)];
  }

  return [];
}

function pickInstance(
  rows: InstanceRow[],
  instanceName: string,
): InstanceRow | undefined {
  const target = instanceName.trim().toLowerCase();
  return (
    rows.find((r) => r.instanceName.toLowerCase() === target) ??
    rows.find((r) =>
      r.instanceName.toLowerCase().includes(target),
    ) ??
    rows[0]
  );
}

async function evolutionRequest<T>(
  settings: EvolutionSettings,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${settings.baseUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: settings.apiKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof body === "object" &&
      body !== null &&
      "response" in body &&
      typeof (body as { response?: { message?: unknown } }).response?.message ===
        "object"
        ? JSON.stringify(
            (body as { response: { message: unknown } }).response.message,
          )
        : typeof body === "object" && body !== null && "error" in body
          ? String((body as { error: unknown }).error)
          : text.slice(0, 300) || res.statusText;
    throw new Error(msg || `Evolution HTTP ${res.status}`);
  }

  return body as T;
}

function toQrDataUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const base64 =
    (typeof p.base64 === "string" && p.base64) ||
    (typeof p.qrcode === "string" && p.qrcode) ||
    null;
  if (base64) {
    return base64.startsWith("data:")
      ? base64
      : `data:image/png;base64,${base64}`;
  }
  const code = typeof p.code === "string" ? p.code : null;
  if (!code) return null;
  if (code.startsWith("data:image")) return code;
  if (code.length > 200 && /^[A-Za-z0-9+/=]+$/.test(code.slice(0, 80))) {
    return `data:image/png;base64,${code}`;
  }
  return null;
}

export async function getWhatsAppStatus(
  settings: EvolutionSettings,
): Promise<WhatsAppStatus> {
  if (!settings.configured) {
    return {
      configured: false,
      instanceName: settings.instanceName || null,
      status: "unknown",
      stateRaw: null,
      phone: null,
      profileName: null,
      profilePictureUrl: null,
      webhookUrl: settings.webhookUrl,
      integration: null,
      error:
        "Defina EVOLUTION_BASE_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE no serviço agente-ia.",
    };
  }

  const name = settings.instanceName;

  try {
    const encoded = encodeURIComponent(name);
    const [statePayload, filteredPayload, allPayload] = await Promise.all([
      evolutionRequest<unknown>(
        settings,
        `/instance/connectionState/${encoded}`,
      ).catch(() => null),
      evolutionRequest<unknown>(
        settings,
        `/instance/fetchInstances?instanceName=${encoded}`,
      ).catch(() => null),
      evolutionRequest<unknown>(settings, `/instance/fetchInstances`).catch(
        () => null,
      ),
    ]);

    const fromFiltered = extractInstances(filteredPayload);
    const fromAll = extractInstances(allPayload);
    const instances = fromFiltered.length > 0 ? fromFiltered : fromAll;
    const row = pickInstance(instances, name);

    const stateFromEndpoint = extractState(statePayload);
    const stateFromRow = row?.status ?? null;
    const stateRaw = stateFromEndpoint ?? stateFromRow ?? null;
    let status = mapState(stateRaw ?? undefined);

    if (status === "unknown" && row?.owner && parseOwnerPhone(row.owner)) {
      status = "connected";
    }

    return {
      configured: true,
      instanceName: row?.instanceName ?? name,
      status,
      stateRaw,
      phone: parseOwnerPhone(row?.owner),
      profileName: row?.profileName ?? null,
      profilePictureUrl: row?.profilePictureUrl ?? null,
      webhookUrl: settings.webhookUrl,
      integration: row?.integration ?? null,
      error:
        status === "unknown" && !stateRaw
          ? `Evolution não retornou estado para "${name}". Confira EVOLUTION_INSTANCE (nome exato no painel Evolution).`
          : null,
    };
  } catch (err) {
    return {
      configured: true,
      instanceName: name,
      status: "unknown",
      stateRaw: null,
      phone: null,
      profileName: null,
      profilePictureUrl: null,
      webhookUrl: settings.webhookUrl,
      integration: null,
      error: err instanceof Error ? err.message : "Falha ao consultar Evolution",
    };
  }
}

export async function connectWhatsApp(
  settings: EvolutionSettings,
): Promise<WhatsAppConnectResult> {
  if (!settings.configured) {
    throw new Error("Evolution não configurada na API");
  }

  const payload = await evolutionRequest<unknown>(
    settings,
    `/instance/connect/${encodeURIComponent(settings.instanceName)}`,
  );

  const p =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  const pairingCode =
    typeof p.pairingCode === "string" ? p.pairingCode : null;
  const qrCodeDataUrl = toQrDataUrl(payload);

  let message: string | null = null;
  if (!qrCodeDataUrl && pairingCode) {
    message = `No WhatsApp: Aparelhos conectados → Conectar → usar código ${pairingCode}`;
  } else if (!qrCodeDataUrl) {
    message =
      "Conexão iniciada. Se o QR não aparecer, use Desconectar e tente de novo.";
  }

  return { qrCodeDataUrl, pairingCode, message };
}

export async function disconnectWhatsApp(
  settings: EvolutionSettings,
): Promise<void> {
  if (!settings.configured) {
    throw new Error("Evolution não configurada na API");
  }

  await evolutionRequest(
    settings,
    `/instance/logout/${encodeURIComponent(settings.instanceName)}`,
    { method: "DELETE" },
  );
}
