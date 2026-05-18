import path from "node:path";
import type pg from "pg";

export type CatalogColumn = {
  key: string;
  label: string;
  inferredType: string;
};

export type CatalogImportResult = {
  upserted: number;
  activeCount: number;
  total: number;
  columns: CatalogColumn[];
  itemCodeKey: string;
  titleKey: string | null;
  activeKey: string | null;
  delimiter?: string;
  error: string | null;
};

export type CatalogPreview = {
  columns: CatalogColumn[];
  delimiter: string;
  rowCount: number;
  itemCodeKey: string;
  titleKey: string | null;
  activeKey: string | null;
  sample: Array<{
    itemCode: string;
    title: string | null;
    active: boolean;
    fields: Record<string, string>;
  }>;
};

type ImportCore = {
  analyzeCatalogCsv: (buffer: Buffer) => CatalogPreview;
  importCatalogCsv: (
    db: pg.Pool,
    buffer: Buffer,
    options?: {
      filename?: string;
      itemCodeKey?: string;
      titleKey?: string | null;
      activeKey?: string | null;
    },
  ) => Promise<CatalogImportResult>;
};

let corePromise: Promise<ImportCore> | null = null;

async function loadCore(): Promise<ImportCore> {
  if (!corePromise) {
    const appRoot = process.env.APP_ROOT?.trim() || "/app";
    const corePath = path.join(
      appRoot,
      "scripts/lib/generic-catalog-import.mjs",
    );
    corePromise = import(corePath) as Promise<ImportCore>;
  }
  return corePromise;
}

export async function previewCatalogCsv(
  buffer: Buffer,
): Promise<CatalogPreview> {
  const core = await loadCore();
  return core.analyzeCatalogCsv(buffer);
}

export async function importCatalogCsv(
  pool: pg.Pool,
  buffer: Buffer,
  options?: {
    filename?: string;
    itemCodeKey?: string;
    titleKey?: string | null;
    activeKey?: string | null;
  },
): Promise<CatalogImportResult> {
  const core = await loadCore();
  return core.importCatalogCsv(pool, buffer, options);
}
