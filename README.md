# Agente IA

Repositório: **https://github.com/ftsmazzo/agente-ia**

Plataforma **white-label** de agente de IA para imobiliárias — pseudo-SaaS por instalação (um deploy por cliente), sem nomes de marca no código-fonte.

## O que é

- **API** (`apps/api`): agente, regras de negócio, prompts, auditoria.
- **Shared** (`packages/shared`): `BrandConfig`, schemas, templates.
- **Orquestração** (`n8n/workflows`): webhooks, debounce, envio WhatsApp (a importar).
- **Infra por cliente**: PostgreSQL, Redis, Evolution, Chatwoot, n8n no EasyPanel.

A marca (`BRAND_NAME`, assistente, cores) vem **só** das variáveis de ambiente de cada implantação.

## Início rápido

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run build
npm run db:migrate
npm run dev
```

- Health: http://localhost:3000/health  
- Docs: [docs/README.md](./docs/README.md)

## Estrutura

```
realty-agent-platform/
├── apps/api/              # Backend Fastify (Docker → EasyPanel)
├── packages/shared/       # BrandConfig, Zod schemas
├── config/prompts/        # Templates {{brand_name}}
├── db/migrations/         # Schema genérico app.*
├── n8n/workflows/         # Exports n8n (versionados)
├── deploy/clients/        # Template por cliente (secrets fora do Git)
├── docs/                  # Documentação
└── scripts/               # Migrations, brand-leak CI
```

## White-label

```env
BRAND_NAME=Minha Imobiliária
BRAND_SLUG=minha-imobiliaria
ASSISTANT_NAME=Assistente
ASSISTANT_TITLE=consultora imobiliária
```

Detalhes: [docs/white-label.md](./docs/white-label.md)

## Qualidade

```bash
npm run ci          # typecheck + brand-leaks + build + test
npm run check:brand-leaks
```

Nomes de clientes vão em `scripts/banned-brands.txt`, **não** no código.

## Deploy

Imagem Docker: `apps/api/Dockerfile` (build context = raiz do repo).

Guia: [docs/deployment-easypanel.md](./docs/deployment-easypanel.md)

## Deploy EasyPanel

Guia passo a passo: [docs/easypanel-deploy.md](./docs/easypanel-deploy.md)

## Roadmap

| Fase | Status |
|------|--------|
| 0 — Fundação (estrutura, BrandConfig, docs, CI) | ✅ |
| 1 — Postgres, Redis, idempotência, lead upsert | ✅ |
| 1b — Migrations automáticas no deploy | ✅ |
| 2 — Workflow n8n mínimo (Evolution → API) | ✅ importar |
| 3 — Motor LLM + debounce + áudio | 🔜 |
| 4 — Chatwoot handoff | 🔜 |
| 4 — Admin UI (opcional) | 🔜 |

## Licença

Proprietary — UNLICENSED. Ajuste conforme seu modelo de distribuição.
