import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type pg from "pg";
import type { FeatureFlags } from "@realty/shared";

export type ProductCapabilityDef = {
  id: string;
  label: string;
  description: string;
  portalToggle: boolean;
  promptFile: string | null;
  apiFeatures: Array<keyof FeatureFlags | string>;
  workflows: string[];
  requires: string[];
  env?: { api?: string[]; n8n?: string[] };
};

export type ProductManifest = {
  id: string;
  name: string;
  description: string;
  defaultCapabilities: string[];
  capabilities: ProductCapabilityDef[];
};

export type CapabilityInstallStatus = {
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

const CONFIG_ROOT =
  process.env.CONFIG_ROOT?.trim() || join(process.cwd(), "config");

let manifestCache: ProductManifest | null = null;
const promptCache = new Map<string, string>();

export const AGENTES_IA_DEFAULT_CAPABILITIES = [
  "catalog",
  "property-rag",
  "scheduling",
  "visit-reminders",
  "handoff",
] as const;

export async function loadProductManifest(
  productId = "agentes-ia",
): Promise<ProductManifest> {
  if (manifestCache?.id === productId) return manifestCache;
  const raw = await readFile(
    join(CONFIG_ROOT, "product", `${productId}.manifest.json`),
    "utf-8",
  );
  manifestCache = JSON.parse(raw) as ProductManifest;
  return manifestCache;
}

export function getPortalCapabilities(
  manifest: ProductManifest,
): ProductCapabilityDef[] {
  return manifest.capabilities.filter((c) => c.portalToggle);
}

function envPresent(key: string): boolean {
  const v = process.env[key];
  return v !== undefined && v !== "" && v !== "false";
}

function apiFeatureOk(
  features: FeatureFlags,
  feature: string,
): boolean {
  switch (feature) {
    case "scheduling":
      return features.scheduling;
    case "propertyRag":
      return features.propertyRag;
    case "humanHandoff":
      return features.humanHandoff;
    case "audioReply":
      return features.audioReply;
    default:
      return true;
  }
}

function checkEnvKeys(keys: string[] | undefined): {
  ok: boolean;
  missing: string[];
} {
  if (!keys?.length) return { ok: true, missing: [] };
  const required = keys.filter((k) => !k.startsWith("FEATURE_"));
  const missing = required.filter((k) => !envPresent(k));
  const featureOff = keys
    .filter((k) => k.startsWith("FEATURE_"))
    .filter((k) => process.env[k] === "false");
  return {
    ok: missing.length === 0 && featureOff.length === 0,
    missing: [...missing, ...featureOff],
  };
}

export async function evaluateCapabilityInstall(
  manifest: ProductManifest,
  enabledIds: string[],
  features: FeatureFlags,
  pool: pg.Pool,
): Promise<CapabilityInstallStatus[]> {
  const byId = new Map(manifest.capabilities.map((c) => [c.id, c]));
  const portalCaps = getPortalCapabilities(manifest);

  let catalogCount = 0;
  try {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM app.catalog_items WHERE active = TRUE`,
    );
    catalogCount = Number(rows[0]?.count ?? 0);
  } catch {
    catalogCount = 0;
  }

  return portalCaps.map((cap) => {
    const enabledInPortal = enabledIds.includes(cap.id);
    const apiEnv = checkEnvKeys(cap.env?.api);
    const featuresOk = (cap.apiFeatures as string[]).every((f) =>
      apiFeatureOk(features, f),
    );
    let installed = featuresOk && apiEnv.ok;
    let detail = installed
      ? "Configuração da API ok"
      : `API: ${[
          ...(cap.apiFeatures as string[])
            .filter((f) => !apiFeatureOk(features, f))
            .map((f) => `desligue ${f} no env ou ative a função`),
          ...apiEnv.missing.map((k) => `falta ${k}`),
        ].join("; ")}`;

    if (cap.id === "catalog" && catalogCount === 0) {
      installed = false;
      detail = "Catálogo vazio — importe CSV no portal";
    }

    if (cap.id === "visit-reminders" && !enabledIds.includes("scheduling")) {
      installed = false;
      detail = "Requer função Agenda ativa";
    }

    if (!enabledInPortal) {
      return {
        id: cap.id,
        label: cap.label,
        enabledInPortal: false,
        installed: true,
        status: "ok",
        detail: "Desligada no agente (comportamento)",
        workflows: cap.workflows,
        envApi: cap.env?.api ?? [],
        envN8n: cap.env?.n8n ?? [],
      };
    }

    const requiresOk = cap.requires.every((reqId) => {
      const req = byId.get(reqId);
      if (!req) return true;
      if (req.id === "whatsapp-core") {
        return apiEnv.ok;
      }
      return enabledIds.includes(reqId);
    });

    if (!requiresOk) {
      installed = false;
      detail = `Depende de: ${cap.requires.join(", ")}`;
    }

    if (cap.workflows.length > 0) {
      detail += ` · Importe no n8n: ${cap.workflows.join(", ")}`;
    }

    const status: CapabilityInstallStatus["status"] = !installed
      ? "warn"
      : "ok";

    return {
      id: cap.id,
      label: cap.label,
      enabledInPortal,
      installed,
      status,
      detail,
      workflows: cap.workflows,
      envApi: cap.env?.api ?? [],
      envN8n: cap.env?.n8n ?? [],
    };
  });
}

export async function loadCapabilityPrompt(
  promptFile: string,
): Promise<string> {
  if (promptCache.has(promptFile)) return promptCache.get(promptFile)!;
  const text = await readFile(
    join(CONFIG_ROOT, "capabilities", promptFile),
    "utf-8",
  );
  promptCache.set(promptFile, text.trim());
  return promptCache.get(promptFile)!;
}

export async function formatCapabilitiesPromptBlock(
  enabledIds: string[],
  productId = "agentes-ia",
): Promise<string> {
  const manifest = await loadProductManifest(productId);
  const lines: string[] = ["## Funções ativas (pacote agentes-ia)"];

  for (const cap of manifest.capabilities) {
    if (!cap.portalToggle || !enabledIds.includes(cap.id)) continue;
    if (!cap.promptFile) continue;
    const block = await loadCapabilityPrompt(cap.promptFile);
    lines.push("", block);
  }

  const disabled = getPortalCapabilities(manifest).filter(
    (c) => !enabledIds.includes(c.id),
  );
  if (disabled.length) {
    lines.push(
      "",
      "### Funções desligadas neste agente",
      disabled.map((c) => `- ${c.label}: não ofereça este fluxo`).join("\n"),
    );
  }

  return lines.join("\n");
}

export function normalizeCapabilities(
  raw: unknown,
  manifest?: ProductManifest,
): string[] {
  const defaults =
    manifest?.defaultCapabilities ?? [...AGENTES_IA_DEFAULT_CAPABILITIES];
  if (!Array.isArray(raw)) return [...defaults];
  const allowed = new Set(
    (manifest?.capabilities ?? [])
      .filter((c) => c.portalToggle)
      .map((c) => c.id),
  );
  const ids = raw
    .filter((x): x is string => typeof x === "string")
    .filter((id) => allowed.has(id));
  return ids.length ? ids : [...defaults];
}

export function capabilityEnablesScheduling(capabilities: string[]): boolean {
  return capabilities.includes("scheduling");
}
