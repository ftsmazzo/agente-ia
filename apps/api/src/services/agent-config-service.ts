import type pg from "pg";
import {
  formatCapabilitiesPromptBlock,
  loadProductManifest,
  normalizeCapabilities,
  capabilityEnablesScheduling,
  getPortalCapabilities,
  type ProductManifest,
} from "./product-capabilities-service.js";

export type AgentObjectives = {
  schedule: boolean;
  capture: boolean;
  qualify: boolean;
};

export type AgentConfig = {
  productId: string;
  vertical: string;
  companyProfile: string;
  tone: string;
  objectives: AgentObjectives;
  capabilities: string[];
  customRules: string;
  updatedAt: string;
};

const DEFAULT_OBJECTIVES: AgentObjectives = {
  schedule: true,
  capture: true,
  qualify: true,
};

const TONE_LABELS: Record<string, string> = {
  professional_warm: "Profissional e acolhedor",
  formal: "Formal",
  casual: "Descontraído",
  enthusiastic: "Entusiasmado",
};

function rowToConfig(
  row: {
    vertical: string;
    company_profile: string;
    tone: string;
    objectives: AgentObjectives;
    custom_rules: string;
    product_id: string;
    capabilities: unknown;
    updated_at: Date;
  },
  manifest: ProductManifest,
): AgentConfig {
  const objectives = row?.objectives ?? DEFAULT_OBJECTIVES;
  const capabilities = normalizeCapabilities(row?.capabilities, manifest);

  return {
    productId: row?.product_id ?? manifest.id,
    vertical: row?.vertical ?? "realty",
    companyProfile: row?.company_profile ?? "",
    tone: row?.tone ?? "professional_warm",
    objectives: {
      schedule:
        objectives.schedule !== false &&
        capabilityEnablesScheduling(capabilities),
      capture: objectives.capture !== false,
      qualify: objectives.qualify !== false,
    },
    capabilities,
    customRules: row?.custom_rules ?? "",
    updatedAt: (row?.updated_at ?? new Date()).toISOString(),
  };
}

export async function getAgentConfig(pool: pg.Pool): Promise<AgentConfig> {
  const manifest = await loadProductManifest();
  const { rows } = await pool.query<{
    vertical: string;
    company_profile: string;
    tone: string;
    objectives: AgentObjectives;
    custom_rules: string;
    product_id: string;
    capabilities: unknown;
    updated_at: Date;
  }>(
    `SELECT vertical, company_profile, tone, objectives, custom_rules,
            product_id, capabilities, updated_at
     FROM app.agent_config WHERE id = 1`,
  );

  return rowToConfig(rows[0] ?? ({} as never), manifest);
}

export async function updateAgentConfig(
  pool: pg.Pool,
  patch: Partial<{
    companyProfile: string;
    tone: string;
    objectives: AgentObjectives;
    capabilities: string[];
    customRules: string;
  }>,
): Promise<AgentConfig> {
  const manifest = await loadProductManifest();
  const current = await getAgentConfig(pool);

  const companyProfile =
    patch.companyProfile !== undefined
      ? patch.companyProfile.slice(0, 8000)
      : current.companyProfile;
  const tone = patch.tone !== undefined ? patch.tone.slice(0, 48) : current.tone;
  const customRules =
    patch.customRules !== undefined
      ? patch.customRules.slice(0, 4000)
      : current.customRules;
  let capabilities =
    patch.capabilities !== undefined
      ? normalizeCapabilities(patch.capabilities, manifest)
      : current.capabilities;

  if (capabilities.includes("visit-reminders") && !capabilities.includes("scheduling")) {
    capabilities = [...capabilities, "scheduling"];
  }

  const objectives = {
    ...(patch.objectives ?? current.objectives),
    schedule: capabilityEnablesScheduling(capabilities)
      ? (patch.objectives?.schedule ?? current.objectives.schedule) !== false
      : false,
  };

  await pool.query(
    `UPDATE app.agent_config
     SET company_profile = $1,
         tone = $2,
         objectives = $3::jsonb,
         capabilities = $4::jsonb,
         custom_rules = $5,
         updated_at = NOW()
     WHERE id = 1`,
    [
      companyProfile,
      tone,
      JSON.stringify(objectives),
      JSON.stringify(capabilities),
      customRules,
    ],
  );

  return getAgentConfig(pool);
}

/** Bloco injetado no system prompt (camadas 3–5). */
export async function formatAgentConfigPromptBlock(
  config: AgentConfig,
): Promise<string> {
  const lines = [
    "## Configuração desta empresa (portal)",
    `Tom de voz: ${TONE_LABELS[config.tone] ?? config.tone}`,
  ];

  const goals: string[] = [];
  if (config.objectives.capture) goals.push("captar interesse e dados de contato");
  if (config.objectives.qualify) goals.push("qualificar perfil e necessidade");
  if (config.objectives.schedule) goals.push("agendar visita ou reunião quando fizer sentido");
  if (goals.length) {
    lines.push(`Objetivos prioritários: ${goals.join("; ")}.`);
  } else {
    lines.push(
      "Objetivos: apenas informar e encaminhar para humano quando necessário.",
    );
  }

  if (config.companyProfile.trim()) {
    lines.push("", "### Sobre a empresa", config.companyProfile.trim());
  }

  if (config.customRules.trim()) {
    lines.push("", "### Regras adicionais do cliente", config.customRules.trim());
  }

  const capBlock = await formatCapabilitiesPromptBlock(
    config.capabilities,
    config.productId,
  );
  lines.push("", capBlock);

  return lines.join("\n");
}

export async function getAgentConfigCatalog(pool: pg.Pool) {
  const manifest = await loadProductManifest();
  const config = await getAgentConfig(pool);
  return {
    product: {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
    },
    capabilities: getPortalCapabilities(manifest).map((c) => ({
      id: c.id,
      label: c.label,
      description: c.description,
      enabled: config.capabilities.includes(c.id),
      requires: c.requires.filter((r) => r !== "whatsapp-core"),
      workflows: c.workflows,
    })),
    whatsappCore: manifest.capabilities.find((c) => c.id === "whatsapp-core"),
  };
}
