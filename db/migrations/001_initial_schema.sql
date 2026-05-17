-- Realty Agent Platform — generic schema (white-label, single-tenant per deployment)
-- Apply with: npm run db:migrate

CREATE SCHEMA IF NOT EXISTS app;

-- ---------------------------------------------------------------------------
-- Audit: every inbound/outbound message event
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.message_events (
  id              BIGSERIAL PRIMARY KEY,
  external_id     VARCHAR(128) NOT NULL,
  phone           VARCHAR(32) NOT NULL,
  direction       VARCHAR(16) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel         VARCHAR(32) NOT NULL DEFAULT 'whatsapp',
  payload_hash    VARCHAR(64),
  workflow_step   VARCHAR(64),
  status          VARCHAR(32) NOT NULL DEFAULT 'received',
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_message_events_external_id UNIQUE (external_id)
);

CREATE INDEX IF NOT EXISTS idx_message_events_phone_created
  ON app.message_events (phone, created_at DESC);

-- ---------------------------------------------------------------------------
-- Conversation state machine (bot | human | paused)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.conversation_state (
  phone           VARCHAR(32) PRIMARY KEY,
  mode            VARCHAR(16) NOT NULL DEFAULT 'bot'
                  CHECK (mode IN ('bot', 'human', 'paused')),
  assignee_ref    VARCHAR(128),
  last_message_at TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- CRM: contacts (deterministic writes — not from LLM)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.contacts (
  phone           VARCHAR(32) PRIMARY KEY,
  display_name    VARCHAR(255),
  profile_notes   TEXT,
  source          VARCHAR(64) DEFAULT 'whatsapp',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- CRM: lead actions (property interest, qualification status)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.lead_actions (
  id              BIGSERIAL PRIMARY KEY,
  phone           VARCHAR(32) NOT NULL REFERENCES app.contacts(phone) ON DELETE CASCADE,
  property_code   VARCHAR(16),
  status          VARCHAR(64) NOT NULL DEFAULT 'qualification',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_actions_phone_property
  ON app.lead_actions (phone, COALESCE(property_code, ''));

CREATE INDEX IF NOT EXISTS idx_lead_actions_phone
  ON app.lead_actions (phone);

-- ---------------------------------------------------------------------------
-- Failed processing queue (dead letter — manual review)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.failed_messages (
  id              BIGSERIAL PRIMARY KEY,
  external_id     VARCHAR(128),
  phone           VARCHAR(32),
  payload         JSONB NOT NULL,
  error_message   TEXT NOT NULL,
  retry_count     INT NOT NULL DEFAULT 0,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_messages_unresolved
  ON app.failed_messages (created_at DESC)
  WHERE resolved_at IS NULL;

-- ---------------------------------------------------------------------------
-- Optional: prompt versions stored in DB (phase 2)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.prompt_versions (
  id              BIGSERIAL PRIMARY KEY,
  template_key    VARCHAR(64) NOT NULL,
  locale          VARCHAR(16) NOT NULL DEFAULT 'pt-BR',
  content         TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_active
  ON app.prompt_versions (template_key, locale)
  WHERE is_active = TRUE;
