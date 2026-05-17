import { readFile } from "node:fs/promises";
import {
  renderTemplate,
  toBrandTemplateContext,
  type BrandConfig,
} from "@realty/shared";

export async function loadSystemPrompt(
  filePath: string,
  brand: BrandConfig,
): Promise<string> {
  const raw = await readFile(filePath, "utf-8");
  const context = toBrandTemplateContext(brand);
  return renderTemplate(raw, context);
}
