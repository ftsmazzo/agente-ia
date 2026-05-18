import type pg from "pg";

export type AgentObjectives = {
  schedule: boolean;
  capture: boolean;
  qualify: boolean;
};

export type AgentConfig = {
  vertical: string;
  companyProfile: string;
  tone: string;
  objectives: AgentObjectives;
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

export async function getAgentConfig(pool: pg.Pool): Promise<AgentConfig> {
  const { rows } = await pool.query<{
    vertical: string;
    company_profile: string;
    tone: string;
    objectives: AgentObjectives;
    custom_rules: string;
    updated_at: Date;
  }>(
    `SELECT vertical, company_profile, tone, objectives, custom_rules, updated_at
     FROM app.agent_config WHERE id = 1`,
  );

  const row = rows[0];
  const objectives = row?.objectives ?? DEFAULT_OBJECTIVES;

  return {
    vertical: row?.vertical ?? "realty",
    companyProfile: row?.company_profile ?? "",
    tone: row?.tone ?? "professional_warm",
    objectives: {
      schedule: objectives.schedule !== false,
      capture: objectives.capture !== false,
      qualify: objectives.qualify !== false,
    },
    customRules: row?.custom_rules ?? "",
    updatedAt: (row?.updated_at ?? new Date()).toISOString(),
  };
}

export async function updateAgentConfig(
  pool: pg.Pool,
  patch: Partial<{
    companyProfile: string;
    tone: string;
    objectives: AgentObjectives;
    customRules: string;
  }>,
): Promise<AgentConfig> {
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
  const objectives = patch.objectives ?? current.objectives;

  await pool.query(
    `UPDATE app.agent_config
     SET company_profile = $1,
         tone = $2,
         objectives = $3::jsonb,
         custom_rules = $4,
         updated_at = NOW()
     WHERE id = 1`,
    [
      companyProfile,
      tone,
      JSON.stringify(objectives),
      customRules,
    ],
  );

  return getAgentConfig(pool);
}

/** Bloco injetado no system prompt (camadas 3–5). */
export function formatAgentConfigPromptBlock(config: AgentConfig): string {
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

  return lines.join("\n");
}
