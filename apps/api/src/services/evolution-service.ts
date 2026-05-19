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
  instanceName?: string;
  instanceId?: string;
  owner?: string;
  profileName?: string;
  profilePictureUrl?: string | null;
  status?: string;
  integration?: { integration?: string };
};

function parseOwnerPhone(owner: string | undefined): string | null {
  if (!owner) return null;
  const digits = owner.split("@")[0]?.replace(/\D/g, "");
  return digits || null;
}

function mapState(state: string | undefined): WhatsAppConnectionStatus {
  const s = (state ?? "").toLowerCase();
  if (s === "open") return "connected";
  if (s === "connecting") return "connecting";
  if (s === "close" || s === "closed") return "disconnected";
  return "unknown";
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

function extractInstances(payload: unknown): InstanceRow[] {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map((item) => {
      if (item && typeof item === "object" && "instance" in item) {
        return (item as { instance: InstanceRow }).instance;
      }
      return item as InstanceRow;
    });
  }
  if (typeof payload === "object" && payload !== null) {
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.response)) {
      return extractInstances(p.response);
    }
    if (p.instance && typeof p.instance === "object") {
      return [p.instance as InstanceRow];
    }
  }
  return [];
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
    const [stateRes, instancesRes] = await Promise.all([
      evolutionRequest<{ instance?: { state?: string } }>(
        settings,
        `/instance/connectionState/${encodeURIComponent(name)}`,
      ).catch(() => ({ instance: undefined })),
      evolutionRequest<unknown>(
        settings,
        `/instance/fetchInstances?instanceName=${encodeURIComponent(name)}`,
      ).catch(() => null),
    ]);

    const instances = extractInstances(instancesRes);
    const row =
      instances.find((i) => i.instanceName === name) ?? instances[0];

    const stateRaw =
      stateRes.instance?.state ?? row?.status ?? null;
    const status = mapState(stateRaw ?? undefined);

    return {
      configured: true,
      instanceName: name,
      status,
      stateRaw,
      phone: parseOwnerPhone(row?.owner),
      profileName: row?.profileName ?? null,
      profilePictureUrl: row?.profilePictureUrl ?? null,
      webhookUrl: settings.webhookUrl,
      integration: row?.integration?.integration ?? null,
      error: null,
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
