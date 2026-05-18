# n8n workflows

Export workflows from n8n as JSON into this folder for version control.

## Workflows

| File | Status | Descrição |
|------|--------|-----------|
| `01-whatsapp-agent.json` | **Pronto para importar** | Evolution → debounce → `/v1/chat` → sendText |
| `02-ingest-debounce.json` | *(legado)* | Debounce agora está no `01` via API |
| `03-audio.json` | Planejado | Transcrição + TTS |
| `04-sync-chatwoot.json` | Planejado | Chatwoot handoff |
| `05-error-notify.json` | Planejado | Alertas de erro |

Guia completo: [docs/n8n-integracao.md](../docs/n8n-integracao.md)

Env vars do n8n: [env.easypanel.example](../env.easypanel.example)
