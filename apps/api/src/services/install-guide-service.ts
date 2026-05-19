import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type pg from "pg";
import type { AppConfig } from "../config/app-config.js";
import type { AgentConfig } from "./agent-config-service.js";
import {
  evaluateCapabilityInstall,
  loadProductManifest,
  type CapabilityInstallStatus,
  type ProductManifest,
} from "./product-capabilities-service.js";

export type InstallPhase = {
  id: string;
  title: string;
  steps: string[];
};

export type InstallWorkflowStep = {
  file: string;
  label: string;
  webhook: string | null;
  required: boolean;
  capabilityIds: string[];
};

export type EnvSyncPair = {
  label: string;
  apiVar: string | null;
  n8nVar: string | null;
  note: string | null;
};

export type ServerEnvCheck = {
  key: string;
  scope: "api";
  ok: boolean;
  hint: string;
};

export type EnvTemplateFile = {
  id: string;
  label: string;
  path: string;
  content: string;
};

export type InstallGuideResponse = {
  product: {
    id: string;
    name: string;
    description: string;
  };
  version: string;
  phases: InstallPhase[];
  workflows: InstallWorkflowStep[];
  envSync: EnvSyncPair[];
  envTemplates: {
    api: string;
    n8n: string;
    evolution: string;
    portal: string;
  };
  envTemplateFiles: EnvTemplateFile[];
  docs: {
    fullGuide: string;
    n8nWorkflows: string;
  };
  capabilities: CapabilityInstallStatus[];
  serverEnv: ServerEnvCheck[];
  overall: "ok" | "warn" | "error";
};

const TEMPLATES_ROOT =
  process.env.ENV_TEMPLATES_ROOT?.trim() ||
  join(process.env.APP_ROOT?.trim() || process.cwd(), "env-templates");

const ENV_TEMPLATE_SPECS = [
  { id: "api", label: "API (agente-ia)", file: "01-agente-ia.env" },
  { id: "n8n", label: "n8n", file: "02-n8n.env" },
  { id: "evolution", label: "Evolution (WhatsApp)", file: "03-evolution.env" },
  { id: "portal", label: "Portal (painel)", file: "07-portal.env" },
  {
    id: "chatwoot",
    label: "Chatwoot (opcional)",
    file: "04-chatwoot.env",
  },
] as const;

async function loadEnvTemplateFiles(): Promise<EnvTemplateFile[]> {
  const out: EnvTemplateFile[] = [];
  for (const spec of ENV_TEMPLATE_SPECS) {
    const path = `env-templates/${spec.file}`;
    try {
      const content = await readFile(join(TEMPLATES_ROOT, spec.file), "utf-8");
      out.push({ id: spec.id, label: spec.label, path, content });
    } catch {
      out.push({ id: spec.id, label: spec.label, path, content: "" });
    }
  }
  return out;
}

const PHASES: InstallPhase[] = [
  {
    id: "infra",
    title: "1. Infraestrutura",
    steps: [
      "Criar Postgres e Redis no EasyPanel (ou serviços dedicados).",
      "Anotar DATABASE_URL e REDIS_URL para a API.",
    ],
  },
  {
    id: "api",
    title: "2. API (agente-ia)",
    steps: [
      "Colar env-templates/01-agente-ia.env no serviço da API.",
      "Preencher marca (BRAND_*), API_INTERNAL_KEY, LLM, RAG, DATABASE_URL, REDIS_URL.",
      "PORTAL_CORS_ORIGIN = URL exata do portal.",
      "Deploy e conferir /health.",
    ],
  },
  {
    id: "portal",
    title: "3. Portal (painel-ia)",
    steps: [
      "PORTAL_API_URL ou VITE_API_URL = URL pública da API.",
      "Deploy, login admin, Personalizar agente, Agenda, Catálogo.",
    ],
  },
  {
    id: "evolution",
    title: "4. Evolution (WhatsApp)",
    steps: [
      "Instância com nome = EVOLUTION_INSTANCE (igual na API e n8n).",
      "Webhook → https://SEU-N8N/webhook/whatsapp-agent",
      "Conectar QR no portal (WhatsApp).",
    ],
  },
  {
    id: "n8n",
    title: "5. n8n (workflows)",
    steps: [
      "Colar env-templates/02-n8n.env no serviço n8n.",
      "N8N_BLOCK_ENV_ACCESS_IN_NODE=false",
      "Importar workflows (ordem abaixo) e Activate.",
      "Reiniciar n8n após mudar env.",
    ],
  },
  {
    id: "test",
    title: "6. Testes",
    steps: [
      "Mensagem oi no WhatsApp.",
      "Busca imóvel / código AP.",
      "Agendar visita → remarcar → lembrete SIM/NÃO ao cliente.",
    ],
  },
];

const WORKFLOW_META: Record<
  string,
  { label: string; webhook: string | null; required: boolean }
> = {
  "01-whatsapp-agent.json": {
    label: "WhatsApp → API",
    webhook: "/webhook/whatsapp-agent",
    required: true,
  },
  "06-ops-notifications.json": {
    label: "Lembretes + alertas",
    webhook: null,
    required: true,
  },
  "04-sync-chatwoot.json": {
    label: "Handoff Chatwoot",
    webhook: "/webhook/chatwoot-sync",
    required: false,
  },
};

const ENV_SYNC: EnvSyncPair[] = [
  {
    label: "Chave interna API ↔ n8n",
    apiVar: "API_INTERNAL_KEY",
    n8nVar: "AGENT_API_KEY",
    note: "Mesmo valor nos dois serviços",
  },
  {
    label: "Debounce WhatsApp",
    apiVar: "DEBOUNCE_MS",
    n8nVar: "DEBOUNCE_MS",
    note: "Mesmo número (ex.: 5000)",
  },
  {
    label: "Instância Evolution",
    apiVar: "EVOLUTION_INSTANCE",
    n8nVar: "EVOLUTION_INSTANCE",
    note: "Nome exato da instância",
  },
];

function envOk(key: string): boolean {
  const v = process.env[key];
  return v !== undefined && v !== "" && v !== "false";
}

function buildServerEnvChecks(config: AppConfig): ServerEnvCheck[] {
  const checks: ServerEnvCheck[] = [
    {
      key: "API_INTERNAL_KEY",
      scope: "api",
      ok: envOk("API_INTERNAL_KEY"),
      hint: "Chave para n8n (AGENT_API_KEY)",
    },
    {
      key: "DATABASE_URL",
      scope: "api",
      ok: envOk("DATABASE_URL"),
      hint: "PostgreSQL",
    },
    {
      key: "REDIS_URL",
      scope: "api",
      ok: envOk("REDIS_URL"),
      hint: "Redis",
    },
    {
      key: "OPENAI_API_KEY / ANTHROPIC_API_KEY",
      scope: "api",
      ok: envOk("OPENAI_API_KEY") || envOk("ANTHROPIC_API_KEY"),
      hint: "Pelo menos um LLM",
    },
    {
      key: "PORTAL_CORS_ORIGIN",
      scope: "api",
      ok: config.portal.corsOrigins !== false,
      hint: "URL do portal para CORS",
    },
    {
      key: "EVOLUTION_BASE_URL",
      scope: "api",
      ok: Boolean(config.evolution.baseUrl?.trim()),
      hint: "Portal conecta WhatsApp",
    },
    {
      key: "EVOLUTION_INSTANCE",
      scope: "api",
      ok: Boolean(config.evolution.instanceName?.trim()),
      hint: "Nome da instância",
    },
  ];

  if (config.features.propertyRag) {
    checks.push({
      key: "RAG_API_URL + RAG_API_KEY",
      scope: "api",
      ok: envOk("RAG_API_URL") && envOk("RAG_API_KEY"),
      hint: "Base de conhecimento",
    });
  }

  return checks;
}

function buildWorkflows(manifest: ProductManifest): InstallWorkflowStep[] {
  const seen = new Map<string, InstallWorkflowStep>();
  for (const cap of manifest.capabilities) {
    for (const file of cap.workflows) {
      if (seen.has(file)) {
        const existing = seen.get(file)!;
        if (!existing.capabilityIds.includes(cap.id)) {
          existing.capabilityIds.push(cap.id);
        }
        continue;
      }
      const meta = WORKFLOW_META[file] ?? {
        label: file,
        webhook: null,
        required: false,
      };
      seen.set(file, {
        file,
        label: meta.label,
        webhook: meta.webhook,
        required: meta.required,
        capabilityIds: [cap.id],
      });
    }
  }
  return [...seen.values()].sort((a, b) => a.file.localeCompare(b.file));
}

function overallFrom(
  caps: CapabilityInstallStatus[],
  env: ServerEnvCheck[],
): "ok" | "warn" | "error" {
  if (env.some((e) => !e.ok && /DATABASE|REDIS|API_INTERNAL/.test(e.key))) {
    return "error";
  }
  if (caps.some((c) => c.enabledInPortal && !c.installed)) return "warn";
  if (env.some((e) => !e.ok)) return "warn";
  return "ok";
}

export async function buildInstallGuide(
  appConfig: AppConfig,
  agentConfig: AgentConfig,
  pool: pg.Pool,
): Promise<InstallGuideResponse> {
  const manifest = await loadProductManifest(agentConfig.productId);
  const capabilities = await evaluateCapabilityInstall(
    manifest,
    agentConfig.capabilities,
    appConfig.features,
    pool,
  );
  const serverEnv = buildServerEnvChecks(appConfig);
  const envTemplateFiles = await loadEnvTemplateFiles();

  return {
    product: {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
    },
    version: process.env.APP_VERSION ?? "0.0.0",
    phases: PHASES,
    workflows: buildWorkflows(manifest),
    envSync: ENV_SYNC,
    envTemplates: {
      api: "env-templates/01-agente-ia.env",
      n8n: "env-templates/02-n8n.env",
      evolution: "env-templates/03-evolution.env",
      portal: "env-templates/07-portal.env",
    },
    envTemplateFiles,
    docs: {
      fullGuide: "docs/instalacao-nova-empresa.md",
      n8nWorkflows: "n8n/workflows/INSTALL.md",
    },
    capabilities,
    serverEnv,
    overall: overallFrom(capabilities, serverEnv),
  };
}
