-- Endereço e link Maps para confirmação ao cliente e alerta ao corretor.

ALTER TABLE app.appointment_settings
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS maps_url TEXT;
