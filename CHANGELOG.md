# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2026-05-17

### Fixed

- `.dockerignore` excluía `scripts/` — migrations/entrypoint não entravam na imagem

## [0.3.1] - 2026-05-17

### Fixed

- Entrypoint em Node (`docker-entrypoint.mjs`) — evita falha `no such file` por CRLF no `.sh` (Windows)
- Retry de conexão Redis/Postgres na subida da API (EasyPanel)
- `.gitattributes` para line endings LF em scripts
- Healthcheck `start-period` 90s

## [0.3.0] - 2026-05-17

### Added

- Migrations SQL **automáticas** no startup do container (`docker-entrypoint.sh`)
- Espera Postgres com retry antes das migrations (`wait-for-database.mjs`)
- `db/migrations` incluído na imagem Docker

### Changed

- Health `version` via `APP_VERSION` (padrão `0.3.0`)
- Healthcheck `start-period` 60s (tempo para migrations na primeira subida)
- `pg` como dependência de produção (migrations no container)

## [0.2.4] - 2026-05-17

### Fixed

- Removido parâmetro `message` não usado em `lead-service`
- `ARG GIT_SHA` no Dockerfile para invalidar cache do EasyPanel entre deploys

## [0.2.3] - 2026-05-17

### Fixed

- Erros TypeScript strict em `lead-service.ts` (build Docker)

## [0.2.2] - 2026-05-17

### Fixed

- TypeScript build no Docker: removido `project references` que exigia `composite` no shared

## [0.2.1] - 2026-05-17

### Fixed

- `Dockerfile` na raiz do repositório para deploy EasyPanel (path padrão)
- `.dockerignore` para builds mais rápidos
- Documentação: env vars em runtime, não como build args

## [0.2.0] - 2026-05-16

### Added

- PostgreSQL integration (`message_events`, `failed_messages`, leads)
- Redis idempotency (`idem:{messageId}`)
- Conversation mode check (`human` / `paused` handoff)
- Deterministic lead upsert from message (property code regex)
- Infra plugin with health checks for DB and Redis
- EasyPanel deploy guide (`docs/easypanel-deploy.md`)

### Changed

- `/v1/chat` full phase-1 pipeline (no LLM yet)
- Health endpoint returns `503` when DB/Redis down
- Service name in logs: `agente-ia-api`

## [0.1.0] - 2026-05-16

### Added

- Monorepo structure (`apps/api`, `packages/shared`)
- White-label `BrandConfig` loaded from environment (Zod)
- Feature flags per deployment
- System prompt template with `{{placeholders}}`
- Fastify API: `/health`, `/v1/config/brand`, `/v1/chat` (phase 1 stub)
- Internal auth via `X-API-Key`
- PostgreSQL schema `app.*` (migrations)
- Brand leak CI check (`scripts/check-brand-leaks.mjs`)
- Docker Compose for local Postgres + Redis
- Dockerfile for API (EasyPanel-ready)
- Documentation in `docs/`
- GitHub Actions CI workflow
- Client deploy template in `deploy/clients/_template/`

[0.1.0]: https://github.com/your-org/realty-agent-platform/releases/tag/v0.1.0
