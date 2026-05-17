# Variáveis de ambiente

Referência para `.env` local e EasyPanel. Copie de `.env.example`.

## Obrigatórias (API)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `BRAND_NAME` | Nome exibido da imobiliária | `Example Realty` |
| `BRAND_SLUG` | Identificador kebab-case único | `example-realty` |
| `ASSISTANT_NAME` | Nome da assistente na conversa | `Assistant` |
| `ASSISTANT_TITLE` | Cargo/função | `real estate consultant` |

## Branding opcional

| Variável | Descrição |
|----------|-----------|
| `BRAND_WEBSITE` | URL do site |
| `BRAND_PRIMARY_COLOR` | Hex `#RRGGBB` |
| `BRAND_LOGO_URL` | URL do logo |
| `DEFAULT_LOCALE` | Padrão `pt-BR` |
| `TIMEZONE` | Padrão `America/Sao_Paulo` |

## Features (boolean: true/false)

| Variável | Padrão |
|----------|--------|
| `FEATURE_AUDIO_REPLY` | true |
| `FEATURE_SCHEDULING` | true |
| `FEATURE_PROPERTY_RAG` | true |
| `FEATURE_HUMAN_HANDOFF` | true |

## Runtime

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `NODE_ENV` | development | `production` em deploy |
| `PORT` | 3000 | Porta HTTP da API |
| `LOG_LEVEL` | info | Pino log level |
| `API_INTERNAL_KEY` | — | Chave para n8n (`X-API-Key`) |
| `SYSTEM_PROMPT_PATH` | `/app/config/prompts/system.pt-BR.md` | Template do system prompt |

## Dados

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |

## Migrations (startup automático)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `RUN_MIGRATIONS_ON_START` | `true` | Aplica migrations ao iniciar container |
| `DB_WAIT_MAX_ATTEMPTS` | `30` | Tentativas até Postgres aceitar conexão |
| `DB_WAIT_DELAY_MS` | `2000` | Pausa entre tentativas (ms) |
| `APP_ROOT` | `/app` | Raiz da app no container (interno) |

## Integrações (URLs internas Docker)

| Variável | Uso |
|----------|-----|
| `EVOLUTION_BASE_URL` | API Evolution |
| `EVOLUTION_INSTANCE` | Nome da instância |
| `CHATWOOT_BASE_URL` | API Chatwoot |
| `CHATWOOT_ACCOUNT_ID` | Conta |
| `CHATWOOT_API_TOKEN` | Token admin |
| `N8N_WEBHOOK_BASE_URL` | Base para tools/webhooks |

## IA

| Variável | Uso |
|----------|-----|
| `OPENAI_API_KEY` | LLM / transcrição |
| `ANTHROPIC_API_KEY` | Fallback opcional |
| `GOOGLE_AI_API_KEY` | Modelos Google opcional |

## Observabilidade

| Variável | Uso |
|----------|-----|
| `SENTRY_DSN` | Erros em produção (opcional) |

## Rede Docker (exemplo EasyPanel)

Na mesma rede, a API pode alcançar:

```
DATABASE_URL=postgresql://user:pass@postgres:5432/realty
REDIS_URL=redis://redis:6379/0
EVOLUTION_BASE_URL=http://evolution:8080
CHATWOOT_BASE_URL=http://chatwoot:3000
N8N_WEBHOOK_BASE_URL=http://n8n:5678
```

Chamada n8n → API:

```
http://realty-api:3000/v1/chat
Header: X-API-Key: <API_INTERNAL_KEY>
```
