-- Confirmação operacional (24h antes) e alertas de falhas já notificados.

ALTER TABLE app.appointments
  ADD COLUMN IF NOT EXISTS confirmation_status VARCHAR(32) NOT NULL DEFAULT 'pending'
    CHECK (confirmation_status IN ('pending', 'confirmed', 'declined')),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;

UPDATE app.appointments
SET confirmation_status = 'confirmed',
    confirmed_at = COALESCE(confirmed_at, updated_at)
WHERE status = 'confirmed'
  AND confirmation_status = 'pending';

ALTER TABLE app.failed_messages
  ADD COLUMN IF NOT EXISTS ops_alerted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_window
  ON app.appointments (starts_at)
  WHERE status IN ('scheduled', 'confirmed')
    AND confirmation_status = 'pending'
    AND reminder_24h_sent_at IS NULL;

CREATE TABLE IF NOT EXISTS app.ops_digest_state (
  id       VARCHAR(64) PRIMARY KEY,
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
