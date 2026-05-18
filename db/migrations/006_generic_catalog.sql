-- Catálogo genérico: colunas descobertas no import + itens em JSON (qualquer nicho)

CREATE TABLE IF NOT EXISTS app.catalog_meta (
  id               SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  columns          JSONB NOT NULL DEFAULT '[]',
  item_code_key    TEXT NOT NULL DEFAULT 'item_code',
  title_key        TEXT,
  active_key       TEXT,
  source_filename  TEXT,
  row_count        INT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app.catalog_meta (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app.catalog_items (
  item_code    VARCHAR(128) PRIMARY KEY,
  title        TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  fields       JSONB NOT NULL DEFAULT '{}',
  search_text  TEXT NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_active
  ON app.catalog_items (active);

CREATE INDEX IF NOT EXISTS idx_catalog_items_updated
  ON app.catalog_items (updated_at DESC);
