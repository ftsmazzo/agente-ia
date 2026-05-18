-- Agenda própria: Postgres é a fonte oficial dos horários e visitas.

CREATE TABLE IF NOT EXISTS app.appointment_settings (
  id                 SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  timezone           VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  weekdays           SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::SMALLINT[],
  work_start         TIME NOT NULL DEFAULT '09:00',
  work_end           TIME NOT NULL DEFAULT '18:00',
  slot_minutes       INT NOT NULL DEFAULT 60 CHECK (slot_minutes BETWEEN 15 AND 240),
  duration_minutes   INT NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 240),
  min_notice_minutes INT NOT NULL DEFAULT 120 CHECK (min_notice_minutes >= 0),
  horizon_days       INT NOT NULL DEFAULT 7 CHECK (horizon_days BETWEEN 1 AND 60),
  location           TEXT NOT NULL DEFAULT 'Sede da imobiliária',
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app.appointment_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app.appointments (
  id              BIGSERIAL PRIMARY KEY,
  phone           VARCHAR(32) NOT NULL REFERENCES app.contacts(phone) ON DELETE CASCADE,
  customer_name   VARCHAR(255),
  property_code   VARCHAR(16),
  status          VARCHAR(32) NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show')),
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  timezone        VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  location        TEXT NOT NULL DEFAULT 'Sede da imobiliária',
  source          VARCHAR(64) NOT NULL DEFAULT 'sofia',
  notes           TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_appointments_phone_starts
  ON app.appointments (phone, starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_starts_status
  ON app.appointments (starts_at, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_active_slot
  ON app.appointments (starts_at)
  WHERE status IN ('scheduled', 'confirmed');
