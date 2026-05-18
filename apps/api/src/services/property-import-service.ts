import path from "node:path";
import type pg from "pg";

export type PropertyImportResult = {
  upserted: number;
  activeCount: number;
  total: number;
  error: string | null;
};

type ImportCore = {
  importPropertiesFromBuffer: (
    db: pg.Pool | pg.PoolClient,
    buffer: Buffer,
    brandWebsite?: string,
  ) => Promise<PropertyImportResult>;
};

let corePromise: Promise<ImportCore> | null = null;

async function loadImportCore(): Promise<ImportCore> {
  if (!corePromise) {
    const appRoot = process.env.APP_ROOT?.trim() || "/app";
    const corePath = path.join(
      appRoot,
      "scripts/lib/import-properties-core.mjs",
    );
    corePromise = import(corePath) as Promise<ImportCore>;
  }
  return corePromise;
}

export async function importPropertiesFromUpload(
  pool: pg.Pool,
  buffer: Buffer,
  brandWebsite?: string,
): Promise<PropertyImportResult> {
  const core = await loadImportCore();
  return core.importPropertiesFromBuffer(pool, buffer, brandWebsite ?? "");
}

export async function getCatalogStats(pool: pg.Pool): Promise<{
  total: number;
  active: number;
  lastImportedAt: string | null;
}> {
  const { rows } = await pool.query<{
    total: string;
    active: string;
    last_imported: Date | null;
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE active = TRUE)::text AS active,
       MAX(imported_at) AS last_imported
     FROM app.properties`,
  );
  return {
    total: Number(rows[0]?.total ?? 0),
    active: Number(rows[0]?.active ?? 0),
    lastImportedAt: rows[0]?.last_imported?.toISOString() ?? null,
  };
}
