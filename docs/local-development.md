# Desenvolvimento local

## Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- Git

## Primeira execução

```bash
cd realty-agent-platform
cp .env.example .env
# Edite BRAND_* com valores de desenvolvimento (exemplo genérico)

docker compose up -d postgres redis
npm install
npm run build
npm run db:migrate
npm run dev
```

Com Docker (`--profile full`), migrations também rodam no entrypoint do container.

```bash
docker compose --profile full up
```

API em `http://localhost:3000`.

## Comandos úteis

| Comando | Ação |
|---------|------|
| `npm run dev` | API em watch mode |
| `npm run build` | Compila shared + api |
| `npm run typecheck` | Verifica TypeScript |
| `npm run check:brand-leaks` | CI local de marcas |
| `npm run db:migrate` | Aplica SQL em `db/migrations/` |
| `npm run ci` | Pipeline completo local |

## Testar endpoints

```bash
curl http://localhost:3000/health

curl http://localhost:3000/v1/config/brand

curl -X POST http://localhost:3000/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: change-me-in-production" \
  -d '{
    "messageId": "test-001",
    "phone": "5511999999999",
    "message": "Olá, vi o apartamento AP0868"
  }'
```

## Docker Compose profiles

- `docker compose up postgres redis` — só infra (recomendado no dia a dia).
- `docker compose --profile full up` — inclui build da API.

## Evolution / Chatwoot / n8n

Não são obrigatórios no laptop. Opções:

1. Apontar webhooks para VPS de staging.
2. Subir stack completo no EasyPanel de homologação.

## Estrutura mental

Você programa em `apps/api` e `packages/shared`. Infra pesada roda no servidor.
