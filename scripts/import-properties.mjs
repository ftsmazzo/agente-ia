#!/usr/bin/env node
/**
 * Importa planilha de imóveis para app.properties.
 * Env: DATABASE_URL, PROPERTIES_XLSX_PATH, BRAND_WEBSITE (opcional, para links)
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import {
  importPropertiesFromBuffer,
  parsePropertiesFromBuffer,
} from "./lib/import-properties-core.mjs";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("[import-properties] DATABASE_URL is required");
    process.exit(1);
  }

  const xlsxPath =
    process.env.PROPERTIES_XLSX_PATH?.trim() ||
    path.join(process.cwd(), "planilha", "Imoveis.xlsx");

  if (!fs.existsSync(xlsxPath)) {
    console.log(`[import-properties] arquivo não encontrado (${xlsxPath}), pulando`);
    process.exit(0);
  }

  const brandWebsite = process.env.BRAND_WEBSITE?.trim() ?? "";

  console.log(`[import-properties] lendo ${xlsxPath}`);
  const buffer = fs.readFileSync(xlsxPath);
  const preview = parsePropertiesFromBuffer(buffer, brandWebsite);
  if (!preview.length) {
    console.warn("[import-properties] nenhuma linha válida na planilha");
    process.exit(0);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  const result = await importPropertiesFromBuffer(
    client,
    buffer,
    brandWebsite,
  );
  await client.end();

  console.log(
    `[import-properties] concluído: ${result.upserted} imóveis (${result.activeCount} ativos)`,
  );
}

main().catch((err) => {
  console.error("[import-properties] falhou:", err);
  process.exit(1);
});
