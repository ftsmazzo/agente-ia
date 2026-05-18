-- Portal: usuários, configuração do agente (camadas 3–5), blackouts de agenda

CREATE TABLE IF NOT EXISTS app.portal_users (
  id            BIGSERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          VARCHAR(120) NOT NULL,
  role          VARCHAR(32) NOT NULL DEFAULT 'client'
                CHECK (role IN ('installer', 'client')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.agent_config (
  id               SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  vertical         VARCHAR(32) NOT NULL DEFAULT 'realty',
  company_profile  TEXT NOT NULL DEFAULT '',
  tone             VARCHAR(48) NOT NULL DEFAULT 'professional_warm',
  objectives       JSONB NOT NULL DEFAULT '{"schedule":true,"capture":true,"qualify":true}'::jsonb,
  custom_rules     TEXT NOT NULL DEFAULT '',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app.agent_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app.scheduling_blackouts (
  id         BIGSERIAL PRIMARY KEY,
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  label      VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_scheduling_blackouts_range
  ON app.scheduling_blackouts (starts_at, ends_at);
