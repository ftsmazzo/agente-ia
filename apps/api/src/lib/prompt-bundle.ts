import { readFile } from "node:fs/promises";
import {
  renderTemplate,
  toBrandTemplateContext,
  type BrandConfig,
} from "@realty/shared";

export type PromptBundle = {
  systemRules: string;
  persona: string;
};

async function loadTemplateFile(
  filePath: string,
  brand: BrandConfig,
): Promise<string> {
  const raw = await readFile(filePath, "utf-8");
  return renderTemplate(raw, toBrandTemplateContext(brand));
}

/**
 * Carrega regras (system) + persona (opcional).
 * Env: SYSTEM_PROMPT_PATH, PERSONA_PROMPT_PATH (default: config/prompts/persona.pt-BR.md)
 */
export async function loadPromptBundle(
  brand: BrandConfig,
  systemPromptPath: string,
  personaPromptPath: string | null,
): Promise<PromptBundle> {
  const systemRules = await loadTemplateFile(systemPromptPath, brand);
  let persona = "";

  if (personaPromptPath) {
    try {
      persona = await loadTemplateFile(personaPromptPath, brand);
    } catch {
      persona = "";
    }
  }

  return { systemRules, persona };
}

export function composeSystemPrompt(bundle: PromptBundle): string {
  if (!bundle.persona.trim()) return bundle.systemRules;
  return [bundle.persona, "---", bundle.systemRules].join("\n\n");
}
