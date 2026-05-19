-- Capacidade por horário (ex.: 3 atendimentos às 10:00). Default 1 = um agendamento por slot.

ALTER TABLE app.appointment_settings
  ADD COLUMN IF NOT EXISTS slot_capacity INT NOT NULL DEFAULT 1
  CHECK (slot_capacity BETWEEN 1 AND 50);

DROP INDEX IF EXISTS app.uq_appointments_active_slot;

CREATE INDEX IF NOT EXISTS idx_appointments_active_starts
  ON app.appointments (starts_at)
  WHERE status IN ('scheduled', 'confirmed');
