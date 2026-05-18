# Variáveis de ambiente

## Copiar e colar no EasyPanel

**Pasta:** [`env-templates/`](../env-templates/) — um arquivo `.env` por serviço.

| Serviço | Arquivo |
|---------|---------|
| API | [`01-agente-ia.env`](../env-templates/01-agente-ia.env) |
| n8n | [`02-n8n.env`](../env-templates/02-n8n.env) |
| Evolution | [`03-evolution.env`](../env-templates/03-evolution.env) |
| Chatwoot | [`04-chatwoot.env`](../env-templates/04-chatwoot.env) |
| Postgres | [`05-postgres.env`](../env-templates/05-postgres.env) |
| Redis | [`06-redis.env`](../env-templates/06-redis.env) |

Checklist e troubleshooting: [variaveis-por-servico.md](./variaveis-por-servico.md)

## Regra de ouro

- **API** → Postgres, Redis, marca, LLM, RAG, `API_INTERNAL_KEY`, debounce.
- **n8n** → `AGENT_API_*`, Evolution, `APPOINTMENT_NOTIFY_PHONE`, `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`.
- **Evolution** → WhatsApp, webhook n8n, integração Chatwoot (painel).
- **Chatwoot** → webhooks para n8n.

Não cole o `.env.example` da API no container n8n.

## Par obrigatório

`API_INTERNAL_KEY` (API) = `AGENT_API_KEY` (n8n)

`DEBOUNCE_MS` (API) = `DEBOUNCE_MS` (n8n)

Documentação detalhada, checklist de reimplantação e troubleshooting: **[variaveis-por-servico.md](./variaveis-por-servico.md)**.
