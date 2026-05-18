import type pg from "pg";
import type { BrandConfig } from "@realty/shared";
import type { RagSearchCriteria } from "../lib/rag-search-criteria.js";
import {
  rowMatchesCriteria,
  textMatchesNeighborhood,
} from "../lib/rag-search-criteria.js";
import { formatPropertyKnowledgeBlock } from "./agent-service.js";

export type CatalogItem = {
  itemCode: string;
  title: string | null;
  active: boolean;
  fields: Record<string, unknown>;
};

type CatalogRow = {
  item_code: string;
  title: string | null;
  active: boolean;
  fields: Record<string, unknown>;
};

function toItem(row: CatalogRow): CatalogItem {
  return {
    itemCode: row.item_code,
    title: row.title,
    active: row.active,
    fields: row.fields ?? {},
  };
}

function fieldStr(fields: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = fields[k];
    if (v !== undefined && v !== null && String(v).trim()) {
      return String(v).trim();
    }
  }
  return "";
}

function itemToRowText(item: CatalogItem): string {
  const f = item.fields;
  const parts = [
    `Referência: ${item.itemCode}`,
    item.title ? `Título: ${item.title}` : null,
    fieldStr(f, "bairro", "bairro_nome", "neighborhood") &&
      `Bairro: ${fieldStr(f, "bairro", "bairro_nome", "neighborhood")}`,
    fieldStr(f, "tipo", "categoria", "category") &&
      `Tipo: ${fieldStr(f, "tipo", "categoria", "category")}`,
    fieldStr(f, "dormitorios", "quartos", "bedrooms") &&
      `Dormitórios: ${fieldStr(f, "dormitorios", "quartos", "bedrooms")}`,
    fieldStr(f, "cidade", "city") &&
      `Cidade: ${fieldStr(f, "cidade", "city")}`,
  ];
  return parts.filter(Boolean).join(" | ");
}

function itemToCard(item: CatalogItem): string {
  const card = item.fields._card;
  if (typeof card === "string" && card.trim()) return card.trim();
  return itemToRowText(item);
}

export async function getCatalogMeta(pool: pg.Pool): Promise<{
  columns: Array<{ key: string; label: string; inferredType: string }>;
  itemCodeKey: string;
  titleKey: string | null;
  rowCount: number;
  updatedAt: string | null;
} | null> {
  const { rows } = await pool.query<{
    columns: Array<{ key: string; label: string; inferredType: string }>;
    item_code_key: string;
    title_key: string | null;
    row_count: number;
    updated_at: Date | null;
  }>(
    `SELECT columns, item_code_key, title_key, row_count, updated_at
     FROM app.catalog_meta WHERE id = 1`,
  );
  const row = rows[0];
  if (!row || row.row_count === 0) return null;
  return {
    columns: row.columns ?? [],
    itemCodeKey: row.item_code_key,
    titleKey: row.title_key,
    rowCount: row.row_count,
    updatedAt: row.updated_at?.toISOString() ?? null,
  };
}

export async function countActiveCatalogItems(pool: pg.Pool): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM app.catalog_items WHERE active = TRUE`,
  );
  return Number(rows[0]?.count ?? 0);
}

export async function getCatalogStats(pool: pg.Pool): Promise<{
  total: number;
  active: number;
  lastImportedAt: string | null;
  columns: Array<{ key: string; label: string }>;
}> {
  const { rows } = await pool.query<{
    total: string;
    active: string;
    last_imported: Date | null;
    columns: Array<{ key: string; label: string }>;
  }>(
    `SELECT
       (SELECT COUNT(*)::text FROM app.catalog_items) AS total,
       (SELECT COUNT(*)::text FROM app.catalog_items WHERE active) AS active,
       (SELECT MAX(updated_at) FROM app.catalog_items) AS last_imported,
       (SELECT columns FROM app.catalog_meta WHERE id = 1) AS columns`,
  );
  return {
    total: Number(rows[0]?.total ?? 0),
    active: Number(rows[0]?.active ?? 0),
    lastImportedAt: rows[0]?.last_imported?.toISOString() ?? null,
    columns: rows[0]?.columns ?? [],
  };
}

export async function getCatalogItemByCode(
  pool: pg.Pool,
  code: string,
): Promise<CatalogItem | null> {
  const normalized = code.trim();
  const { rows } = await pool.query<CatalogRow>(
    `SELECT item_code, title, active, fields
     FROM app.catalog_items
     WHERE active = TRUE
       AND (item_code = $1 OR UPPER(item_code) = UPPER($1))
     LIMIT 1`,
    [normalized],
  );
  return rows[0] ? toItem(rows[0]) : null;
}

/** Tokens da mensagem que batem com item_code no catálogo */
export async function findCatalogCodeInMessage(
  pool: pg.Pool,
  text: string,
): Promise<string | null> {
  const tokens = [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((t) => t.replace(/[^\w-]/g, "").trim())
        .filter((t) => t.length >= 3 && t.length <= 64),
    ),
  ].slice(0, 12);

  if (!tokens.length) return null;

  const { rows } = await pool.query<{ item_code: string }>(
    `SELECT item_code FROM app.catalog_items
     WHERE active = TRUE
       AND (
         item_code = ANY($1::text[])
         OR UPPER(item_code) = ANY(
           SELECT UPPER(x) FROM unnest($1::text[]) AS x
         )
       )
     LIMIT 1`,
    [tokens],
  );
  return rows[0]?.item_code ?? null;
}

export async function searchCatalogByCriteria(
  pool: pg.Pool,
  criteria: RagSearchCriteria,
  limit = 8,
): Promise<CatalogItem[]> {
  const fetchLimit = Math.min(Math.max(limit * 6, 24), 80);
  const { rows } = await pool.query<CatalogRow>(
    `SELECT item_code, title, active, fields
     FROM app.catalog_items
     WHERE active = TRUE
     ORDER BY updated_at DESC
     LIMIT $1`,
    [fetchLimit],
  );

  const items = rows.map(toItem);
  const filtered = items.filter((item) =>
    rowMatchesCriteria(itemToRowText(item), criteria),
  );

  if (criteria.neighborhoods.length > 0) {
    return filtered
      .filter((item) =>
        criteria.neighborhoods.some((n) =>
          textMatchesNeighborhood(itemToRowText(item), n),
        ),
      )
      .slice(0, limit);
  }

  return filtered.slice(0, limit);
}

const MAX_FOR_LLM = 3;

export function buildKnowledgeBlockFromCatalog(
  items: CatalogItem[],
  criteria: RagSearchCriteria,
): string {
  if (!items.length) {
    if (criteria.neighborhoods.length > 0) {
      const bairros = criteria.neighborhoods.join(", ");
      const extra = criteria.bedrooms ? `, ${criteria.bedrooms} quartos` : "";
      return `[DADOS DO SISTEMA]
Nenhum item encontrado na base para: ${bairros}${extra}.
Qualifique o cliente sem inventar ofertas.
[/DADOS DO SISTEMA]`;
    }
    return "";
  }

  const records = items.slice(0, MAX_FOR_LLM).map((item) => ({
    property_code: item.itemCode,
    card: itemToCard(item),
    link:
      typeof item.fields.link === "string" ? item.fields.link : undefined,
  }));

  const inner = formatPropertyKnowledgeBlock(records)
    .replace(/^\[DADOS DO SISTEMA\]\n?/, "")
    .replace(/\n?\[\/DADOS DO SISTEMA\]$/, "")
    .trim();

  const header =
    criteria.neighborhoods.length > 0
      ? `[Critérios: ${criteria.neighborhoods.join(", ")}${criteria.bedrooms ? `; ${criteria.bedrooms} quartos` : ""}]\n`
      : "";

  return `${header}[DADOS DO SISTEMA]
${inner}
[/DADOS DO SISTEMA]`;
}

export function itemToKnowledgeRecord(
  item: CatalogItem,
  brand: BrandConfig,
): Record<string, unknown> {
  const website = brand.brandWebsite?.replace(/\/$/, "") ?? "";
  const link =
    (typeof item.fields.link === "string" && item.fields.link) ||
    (website ? `${website}/item/${encodeURIComponent(item.itemCode)}` : undefined);

  return {
    property_code: item.itemCode,
    card: itemToCard(item),
    ...(link ? { link } : {}),
  };
}
