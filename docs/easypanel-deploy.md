# Primeiro deploy — EasyPanel

Repositório: [github.com/ftsmazzo/agente-ia](https://github.com/ftsmazzo/agente-ia)

## 1. PostgreSQL — migrations

No Postgres do EasyPanel, crie database `agente` (ou use o existente) e rode migrations **uma vez**:

```bash
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB npm run db:migrate
```

Ou terminal one-off com imagem Node apontando para o repo.

## 2. App API no EasyPanel

| Campo | Valor |
|-------|--------|
| Source | GitHub `ftsmazzo/agente-ia` |
| Dockerfile path | `apps/api/Dockerfile` |
| Build context | `.` (raiz) |
| Port | `3000` |
| Health check | `GET /health` |

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

## 6. Próximo passo (n8n)

Workflow `02-call-agent` chamando `http://agente-ia-api:3000/v1/chat` com header `X-API-Key`.

Chatwoot: fase posterior.
