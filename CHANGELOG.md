# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.20.6] - 2026-05-19

### Fixed

- Workflow n8n `06`: mensagem clara se faltar `EVOLUTION_INSTANCE`; doc/env template atualizados

## [0.20.5] - 2026-05-19

### Fixed

- WhatsApp: remarcação/adiamento (`atrasar minha agenda`, `para as 11`) atualiza a visita existente em vez de criar duplicata
- Respostas humanizadas de remarcação; notificação ao operador como "Visita remarcada"
- `minha agenda` não dispara fluxo de agendamento novo

## [0.20.4] - 2026-05-19

### Fixed

- Lembretes ops: janela ampliada (20–28h) + lembrete “em breve” para visitas em 1–20h (testes no mesmo dia)

## [0.20.3] - 2026-05-19

### Fixed

- Build TypeScript: ordem de declaração em `chat.ts` (`mustBlockLlmForScheduling`)

## [0.20.2] - 2026-05-19

### Fixed

- Agenda: aceite após convite cobre respostas curtas sem lista fixa (`acceptsVisitAfterInvite`) — "Adoraria" e similares
- Escolha de horário: `3`, `Opção 3`, `opcao3` sempre disparam booking; LLM bloqueada se ainda houver lista de horários na conversa
- Testes automatizados em `apps/api/test/scheduling-intent.test.js`

## [0.20.1] - 2026-05-19

### Fixed

- Agendamento: "Adoraria" e "Opção N" voltam a acionar booking determinístico (antes caía na LLM e prometia confirmação da equipe sem gravar visita)
- Quando a LLM lista horários numerados, conversa passa a `awaiting_slot` para a escolha do cliente ser processada pela API

## [0.20.0] - 2026-05-18

### Added

- Portal **Agenda**: abas Próximos / Pendentes confirmação / Passados; botões confirmar, recusar e cancelar visita
- Confirmação operacional em `app.appointments` (`confirmation_status`, lembrete 24h)
- API `POST /v1/ops/notifications/tick` — lembretes de visita e alertas de `failed_messages`
- Workflow n8n `06-ops-notifications.json` (cron 30 min → WhatsApp operacional)
- Migração `007_appointment_confirmation_ops.sql`

## [0.19.1] - 2026-05-18

### Fixed

- Build TypeScript: remove parâmetro `pool` não usado em `getDashboardHealthSummary`

## [0.19.0] - 2026-05-18

### Added

- Início: alertas de saúde (WhatsApp, falhas, catálogo, RESET_DEV) com links rápidos
- Doc: [implantacao-nova-empresa.md](./docs/implantacao-nova-empresa.md) — roteiro deploy do zero

### Changed

- `APP_VERSION` lida do `package.json` no startup do container (Sistema e health)

## [0.18.0] - 2026-05-18

### Added

- Portal: tela **Sistema** (`/sistema`) — checklist de saúde (Postgres, Redis, WhatsApp, LLM, catálogo, falhas, CORS)
- API: `GET /v1/portal/system` para implantador validar deploy antes de liberar ao cliente

## [0.17.1] - 2026-05-18

### Fixed

- WhatsApp no portal: parser Evolution compatível com v1/v2 (`connectionStatus`, `ownerJid`, `name`)
- Status “Conectado” quando há número na instância mesmo se o campo de estado vier vazio

## [0.17.0] - 2026-05-18

### Added

- Portal: tela **WhatsApp** — status da instância Evolution, reconectar (QR), desconectar
- API: proxy `GET/POST /v1/portal/whatsapp/*` com `EVOLUTION_BASE_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`
- Doc: [portal-whatsapp.md](./docs/portal-whatsapp.md)

## [0.16.1] - 2026-05-18

### Changed

- Portal: linguagem genérica (sem “corretor”/“visita”/“imóvel”) — modo humano exibido como **Usuário**
- Handoff WhatsApp: mensagem usa “equipe”/“atendente”, não “corretor”

## [0.16.0] - 2026-05-18

### Added

- Portal: tela **Contatos** (CRM automático — qualificação, código, status)
- Portal: em **Conversas**, alternar modo bot/corretor/pausado e reiniciar conversa (implantador)
- API: `GET /v1/portal/contacts`, `PATCH .../conversations/:phone/mode`, `POST .../reset`
- Dashboard: contadores de contatos e atalhos atualizados

### Fixed

- Reset de conversa: remove qualificação de `lead_actions` sem coluna inexistente `action_type`

## [0.15.0] - 2026-05-18

### Added

- Portal: tela **Conversas** — lista contatos, histórico de mensagens e memória Redis
- API: `GET /v1/portal/conversations` e `GET /v1/portal/conversations/:phone`
- Chat grava texto em `message_events.metadata.text` (auditoria legível no painel)

## [0.14.1] - 2026-05-18

### Added

- Catálogo: import em modo **mesclar** (upsert sem apagar itens ausentes no CSV)
- Portal: exportar catálogo em CSV; pré-preenchimento do mapeamento do último import
- API: `GET /v1/portal/catalog/export`; stats com `itemCodeKey`, `titleKey`, `activeKey`

## [0.14.0] - 2026-05-18

### Changed

- Catálogo genérico via **CSV**: detecta colunas do cabeçalho, grava em `app.catalog_items` (JSON por linha)
- Portal: analisar → escolher coluna código/título → importar
- Chat usa `catalog_items` em vez de layout fixo Pazotti (`app.properties` legado)

## [0.13.2] - 2026-05-18

### Fixed

- Portal: corrige Mixed Content — `PORTAL_API_URL` com `http://` vira `https://` quando o painel é HTTPS

## [0.13.1] - 2026-05-18

### Fixed

- Portal: `PORTAL_API_URL` em runtime (`config.js` no startup) — evita Failed to fetch quando o build perde `VITE_API_URL`
- API: `PORTAL_CORS_ORIGIN` aceita várias URLs separadas por vírgula; aviso no log se faltar em produção
- Mensagens de erro do painel mais claras (API URL, CORS)

## [0.13.0] - 2026-05-18

### Added

- Portal: upload de planilha (.xlsx) em **Catálogo**
- Portal: **Monitor** de falhas (`failed_messages`) com resolver (implantador)
- Portal: visitas agendadas e bloqueios de agenda na tela **Agenda**
- API `/v1/portal/catalog/*` e `/v1/portal/ops/*`

## [0.12.1] - 2026-05-18

### Changed

- Usuários do portal criados no startup via env (`PORTAL_ADMIN_*`, `PORTAL_CLIENT_*`) — sem curl/bootstrap
- Senha só atualiza do env com `PORTAL_SYNC_PASSWORD_FROM_ENV=true` (não recria usuário a cada restart)

## [0.12.0] - 2026-05-18

### Added

- Portal web (`apps/portal`) com login, dashboard, agenda e personalização do agente
- API `/v1/portal/*` com JWT, bootstrap do primeiro usuário e roles `installer` / `client`
- `app.portal_users`, `app.agent_config` (tom, empresa, objetivos) injetado no prompt do chat
- `app.scheduling_blackouts` e PATCH de agenda via portal
- [docs/produto-portal.md](./docs/produto-portal.md) e `env-templates/07-portal.env`

## [0.11.0] - 2026-05-18

### Added

- Catálogo `app.properties` (migration `004_properties.sql`) com import automático da planilha no startup do container
- Busca determinística por código `AP####` / `CA####` antes do RAG; fallback por perfil (bairro, quartos) no Postgres
- Script `npm run properties:import` e `PROPERTIES_IMPORT_ON_START` / `PROPERTIES_XLSX_PATH` no deploy EasyPanel
- `GET /health` expõe `catalog.properties_active` e aviso se o catálogo estiver vazio

## [0.10.0] - 2026-05-18

### Added

- Agenda própria no Postgres (`app.appointment_settings`, `app.appointments`)
- Rotas `/v1/scheduling/*` para slots, booking, listagem, status e `.ics`
- SofIA oferece e confirma apenas horários calculados pela API
- `appointmentBooked` no `/v1/chat` para notificação imediata via n8n
- [docs/agenda.md](./docs/agenda.md)

## [0.9.0] - 2026-05-18

### Added

- Handoff: detecta "falar com corretor", modo `human`, resposta de transição
- "Voltar ao bot" restaura modo `bot`
- `GET /v1/conversation`, `POST /v1/conversation/mode` (Chatwoot / n8n)
- Qualificação em `lead_actions.metadata.qualification` (faixa, financiamento, visita, etc.)
- [docs/handoff-chatwoot.md](./docs/handoff-chatwoot.md)

## [0.8.1] - 2026-05-18

### Fixed

- Debounce por **silêncio** (reinicia ao chegar msg nova) — evita 2ª resposta quando o cliente demora na última linha
- Padrão `DEBOUNCE_MS=5000`, `DEBOUNCE_MAX_WAIT_MS=20000`; timeout n8n 30s

## [0.8.0] - 2026-05-18

### Added

- `POST /v1/debounce/wait-and-merge` — consolida mensagens seguidas no Redis antes do LLM
- `DEBOUNCE_MS` (padrão 3000)
- `/health`: `debounce`, `ops.warnings`, `ops.failed_messages_unresolved`
- [docs/operations-production.md](./docs/operations-production.md), [docs/debounce.md](./docs/debounce.md)

### Changed

- Workflow n8n `01-whatsapp-agent.json` usa debounce antes de `/v1/chat`
- README roadmap atualizado (RAG + debounce ✅)

## [0.7.5] - 2026-05-18

### Added

- Parser completo de chunks `Referência: AP####` (valor, bairro, dorm., área, condomínio)
- Fichas estruturadas no `[DADOS DO SISTEMA]` para tom humano no WhatsApp

### Changed

- Query por código inclui `Referência: AP####` (melhor match no RAG)
- Até 3 imóveis por resposta; sem duplicar texto cru do RAG quando há fichas parseadas
- Persona e instruções: proibir catálogo robótico; tom persuasivo

## [0.7.4] - 2026-05-18

### Added

- `RESET_DEV_DATA_ON_START`: trunca Postgres (app.*) e `FLUSHDB` Redis no startup (dev/testes)

### Fixed

- RAG: timeout padrão 45s (evita abort em ~17s enquanto o RAG ainda responde)
- Bloco `[DADOS DO SISTEMA]`: resposta do RAG e registros no mesmo bloco (persona ignorava `[RESUMO]`)
- Não injeta “nenhum imóvel” quando o `answer` do RAG já traz AP####
- Critérios de quartos/banheiros só da mensagem atual (histórico não polui confirmação da SofIA)
- Instrução explícita ao LLM quando há listagens no bloco

## [0.7.3] - 2026-05-18

### Fixed

- TypeScript: tipo `hadRagAnswer` em metadados RAG (`chat.ts`)

## [0.7.2] - 2026-05-17

### Fixed

- RAG: repassa `answer` do RAG à SofIA (`[RESUMO DA BASE DE CONHECIMENTO]`)
- Query RAG sem misturar bairros antigos do histórico (Centro + Planalto)
- Parser chunks `Referência: AP####` / `Bairro:` (formato planilha por linha)
- Metadados `ragSkipReason` quando não chama o RAG (`intent_general`, etc.)

## [0.7.1] - 2026-05-17

### Fixed

- RAG: query com histórico + bairro/quartos; parse CSV `Ativo,AP####`; topK maior em busca por perfil
- Env `RAG_TOP_K_CRITERIA` (padrão 10) para chunks de planilha

## [0.7.0] - 2026-05-17

### Added

- Integração RAG: `POST /api/kb/{id}/query` → bloco `[DADOS DO SISTEMA]` no LLM
- Env: `RAG_API_URL`, `RAG_API_KEY`, `RAG_KNOWLEDGE_BASE_ID`, `RAG_TOP_K`
- Doc [docs/rag-integracao.md](./docs/rag-integracao.md)

## [0.6.4] - 2026-05-17

### Changed

- Persona e system prompt adaptados do legado SofIA (workflow IA Pazotti), white-label
- Contexto runtime inclui data/hora no fuso da marca

## [0.6.3] - 2026-05-17

### Fixed

- GPT-5 / reasoning: Responses API + mínimo 2500 tokens de saída (evita resposta vazia → fallback)
- `/health` expõe `llm.maxTokens`; `/v1/chat` retorna `llmError` quando `llm_fallback`

## [0.6.2] - 2026-05-17

### Fixed

- OpenAI `gpt-5-mini` (e família GPT-5): usa `max_completion_tokens` em vez de `max_tokens` (evita fallback genérico)
- Log e metadata `llmError` quando a API cai em `llm_fallback`

## [0.6.1] - 2026-05-17

### Fixed

- TypeScript build: tipos em `conversation-history` e import não usado em `llm/index`

## [0.6.0] - 2026-05-17

### Added

- Persona em arquivo separado (`config/prompts/persona.pt-BR.md`) + `PERSONA_PROMPT_PATH`
- Multi-provedor LLM: `LLM_PROVIDER=openai|anthropic` (Claude via API Anthropic)
- Classificação de intenção: anúncio com código vs busca por perfil vs geral
- Preparação bloco `[DADOS DO SISTEMA]` para RAG/tabela (fase 2c)
- Doc [docs/arquitetura-persona-rag.md](./docs/arquitetura-persona-rag.md)

## [0.5.0] - 2026-05-17

### Added

- Motor LLM OpenAI (`agent-service.ts`) — respostas reais da assistente
- Histórico de conversa no Redis (`conversation-history.ts`)
- Contexto runtime: nome, código imóvel, regras anti-alucinação
- Fallback automático se OpenAI falhar
- Doc [docs/fase-2-llm.md](./docs/fase-2-llm.md)

### Changed

- `POST /v1/chat` usa LLM quando `OPENAI_API_KEY` está definida
- System prompt ajustado para fase sem RAG

## [0.4.2] - 2026-05-17

### Added

- Gravação de `display_name` via WhatsApp `pushName` (Evolution → n8n → API)
- Atualização do nome no contato quando chega pushName depois
- Detecção leve de "me chamo …" na mensagem
- Doc [docs/dados-gravados.md](./docs/dados-gravados.md)

### Changed

- Workflow n8n envia `metadata.pushName` no POST `/v1/chat`

## [0.4.1] - 2026-05-17

### Fixed

- Postgres `inconsistent types deduced for parameter $1` ao gravar `lead_actions` com código de imóvel

## [0.4.0] - 2026-05-17

### Added

- Workflow n8n `01-whatsapp-agent.json` (Evolution → API → sendText)
- Guia [docs/n8n-integracao.md](./docs/n8n-integracao.md)
- Template env n8n [n8n/env.easypanel.example](./n8n/env.easypanel.example)

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
