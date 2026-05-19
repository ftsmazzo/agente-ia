-- Pacote produto e funções selecionáveis no portal (blocos de prompt).

ALTER TABLE app.agent_config
  ADD COLUMN IF NOT EXISTS product_id VARCHAR(64) NOT NULL DEFAULT 'agentes-ia',
  ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT
    '["catalog","property-rag","scheduling","visit-reminders","handoff"]'::jsonb;
