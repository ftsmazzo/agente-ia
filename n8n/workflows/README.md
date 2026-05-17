# n8n workflows

Export workflows from n8n as JSON into this folder for version control.

## Planned workflows (neutral names)

| File | Purpose |
|------|---------|
| `01-ingest-whatsapp.json` | Webhook Evolution, idempotency, Redis debounce |
| `02-call-agent.json` | HTTP POST to `@realty/api` `/v1/chat` |
| `03-send-reply.json` | Evolution send text/audio |
| `04-sync-chatwoot.json` | Tags, custom attributes, handoff |
| `05-error-notify.json` | Global error workflow — alerts |

Use `{{ $env.BRAND_SLUG }}` in paths where client-specific routing is needed.

Workflows are imported manually or via n8n API in a later phase.
