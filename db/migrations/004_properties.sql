-- Catálogo de imóveis (planilha) — busca determinística por código AP#### / CA####

CREATE TABLE IF NOT EXISTS app.properties (
  property_code     VARCHAR(16) PRIMARY KEY,
  status_label      VARCHAR(32),
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  tipo              VARCHAR(64),
  finalidade        VARCHAR(64),
  bairro            VARCHAR(120),
  cidade            VARCHAR(120),
  condominio        VARCHAR(255),
  endereco_interno  TEXT,
  valor_venda       BIGINT,
  dormitorios       SMALLINT,
  suites            SMALLINT,
  vagas             SMALLINT,
  area_m2           NUMERIC(12, 2),
  link              TEXT,
  card_text         TEXT,
  raw_row           JSONB NOT NULL DEFAULT '{}',
  imported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_active_bairro
  ON app.properties (active, bairro);

CREATE INDEX IF NOT EXISTS idx_properties_active_dorm
  ON app.properties (active, dormitorios);

CREATE INDEX IF NOT EXISTS idx_properties_active_valor
  ON app.properties (active, valor_venda);
