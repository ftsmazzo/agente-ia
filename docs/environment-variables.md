# Variáveis de ambiente

**Referência oficial (por serviço):** [variaveis-por-servico.md](./variaveis-por-servico.md)

Arquivos modelo:

| Serviço | Arquivo |
|---------|---------|
| API `agente-ia` | [`.env.example`](../.env.example) |
| n8n | [`n8n/env.easypanel.example`](../n8n/env.easypanel.example) |

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
