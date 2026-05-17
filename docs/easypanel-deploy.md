# Primeiro deploy — EasyPanel

Repositório: [github.com/ftsmazzo/agente-ia](https://github.com/ftsmazzo/agente-ia)

## 1. PostgreSQL — migrations automáticas

**Não é necessário terminal na VPS.** Ao subir o container da API:

1. Aguarda o Postgres ficar disponível (`wait-for-database.mjs`)
2. Aplica SQL em `db/migrations/` (`run-migrations.mjs`)
3. Inicia a API

Isso roda em **todo deploy/restart** — migrations já aplicadas são ignoradas (`schema_migrations`).

Variáveis opcionais:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `RUN_MIGRATIONS_ON_START` | `true` | `false` desliga migrations no startup |
| `DB_WAIT_MAX_ATTEMPTS` | `30` | Tentativas de conexão ao Postgres |
| `DB_WAIT_DELAY_MS` | `2000` | Intervalo entre tentativas (ms) |

Logs esperados no container: `[entrypoint] applying SQL migrations...` → `[migrate] complete`.

### Se o container não subir

1. Abra **Logs** do serviço no EasyPanel (não precisa de terminal).
2. Erros comuns:
   - `no such file` / `\r` no entrypoint → atualize para v0.3.1+
   - `DATABASE_URL is required` → variável só em **Environment**, não Build Args
   - `relation already exists` → banco parcial; avise para script de repair
3. Envie as últimas 30 linhas do log se precisar de suporte.

Para novo cliente: banco Postgres vazio + redeploy da API = schema pronto.

## 2. App API no EasyPanel

| Campo | Valor |
|-------|--------|
| Source | GitHub `ftsmazzo/agente-ia` |
| Dockerfile path | `Dockerfile` (raiz do repo — **padrão EasyPanel**) |
| Build context | `.` (raiz) |
| Port | `3000` |
| Health check | `GET /health` |

> **Importante:** variáveis (`BRAND_*`, `DATABASE_URL`, etc.) devem ser **Environment Variables** do container, **não** Build Args — a API lê env em runtime.

> Se o build falhar com código antigo após um push, use **Rebuild without cache** no EasyPanel. O Dockerfile usa `GIT_SHA` para invalidar cache automaticamente.

## 3. Variáveis obrigatórias

```env
NODE_ENV=production
PORT=3000

BRAND_NAME=Sua Imobiliária
BRAND_SLUG=sua-imobiliaria
ASSISTANT_NAME=Assistente
ASSISTANT_TITLE=consultora imobiliária

DATABASE_URL=postgresql://...@postgres:5432/...
REDIS_URL=redis://:password@redis:6379/0

API_INTERNAL_KEY=<gerar string longa aleatória>
SYSTEM_PROMPT_PATH=/app/config/prompts/system.pt-BR.md
```

## 4. Rede interna

A API deve estar na **mesma rede** que Postgres e Redis.

Hostname típico EasyPanel: nome do serviço (`postgres`, `redis`, `agente-ia-api`).

## 5. Testes após deploy

```bash
curl https://SEU_DOMINIO/health

curl -X POST https://SEU_DOMINIO/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SEU_API_INTERNAL_KEY" \
  -d '{"messageId":"test-1","phone":"5511999999999","message":"Quero info AP0868"}'
```

`health` deve retornar `"database": true, "redis": true`.

## 6. Fase 2 — OpenAI

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Redeploy da API. Detalhes: [fase-2-llm.md](./fase-2-llm.md)

## 7. Próximo passo (n8n)

Importar workflow e configurar Evolution: [n8n-integracao.md](./n8n-integracao.md)

Chatwoot: fase posterior.
