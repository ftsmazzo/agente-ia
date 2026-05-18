#!/usr/bin/env node
/**
 * Import CSV genérico no startup (opcional).
 * Env: DATABASE_URL, CATALOG_CSV_PATH, CATALOG_IMPORT_ON_START=true
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { importCatalogCsv } from "./lib/generic-catalog-import.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("[import-catalog] DATABASE_URL is required");
  process.exit(1);
}

const csvPath =
  process.env.CATALOG_CSV_PATH?.trim() ||
  process.env.PROPERTIES_XLSX_PATH?.trim()?.replace(/\.xlsx?$/i, ".csv");

if (!csvPath || !fs.existsSync(csvPath)) {
  console.log(`[import-catalog] arquivo não encontrado (${csvPath ?? "?"}), pulando`);
  process.exit(0);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

const buffer = fs.readFileSync(csvPath);
const result = await importCatalogCsv(client, buffer, {
  filename: path.basename(csvPath),
});

await client.end();

if (result.error) {
  console.warn(`[import-catalog] ${result.error}`);
  process.exit(0);
}

console.log(
  `[import-catalog] concluído: ${result.upserted} itens (${result.activeCount} ativos), colunas: ${result.columns.map((c) => c.key).join(", ")}`,
);
