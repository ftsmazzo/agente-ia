# Arquitetura

## Objetivo

Plataforma **white-label** de agente de IA para imobiliárias: uma instalação por cliente (pseudo-SaaS), sem multi-tenant no código na fase inicial.

## Camadas

```
WhatsApp ↔ Evolution API ↔ Chatwoot (UI corretores)
                │
                ▼ webhook
            n8n (orquestração)
                │
                ├── Redis (debounce, idempotência, locks)
                ├── PostgreSQL (CRM, eventos, estado)
                └── API @realty/api (agente, regras, prompts)
```

| Componente | Responsabilidade |
|------------|------------------|
| **Evolution** | Transporte WhatsApp; bridge Chatwoot |
| **Chatwoot** | Inbox, times, atribuição, histórico humano |
| **n8n** | Webhooks, debounce, chamada à API, envio, erros |
| **API** | Agente, máquina de estados, lead determinístico, auditoria |
| **PostgreSQL** | Fonte da verdade de negócio |
| **Redis** | Fila temporária e deduplicação |

## Fluxo de mensagem (alvo)

1. Evolution envia webhook → n8n `01-ingest`.
2. n8n verifica idempotência (`message_id`) e debounce (Redis).
3. n8n chama `POST /v1/chat` na API com `X-API-Key`.
4. API valida modo (`bot` / `human`), executa agente ou abstém.
5. n8n envia resposta via Evolution se `shouldReply=true`.
6. Eventos gravados em `app.message_events`; falhas em `app.failed_messages`.

## Repositório (monorepo)

```
apps/api          → Backend (Fastify)
packages/shared   → BrandConfig, schemas Zod
db/migrations     → Schema SQL genérico
config/prompts    → Templates {{brand_name}}
n8n/workflows     → JSON versionado
deploy/clients    → Templates por cliente (secrets fora do Git)
```

## Fases de implementação

| Fase | Entrega |
|------|---------|
| **0 (atual)** | Estrutura, BrandConfig, health, stub `/v1/chat`, docs, CI |
| **1** | Postgres + Redis na API, idempotência, lead upsert |
| **2** | Motor LLM + tools (imóveis, agenda via n8n) |
| **3** | Workflows n8n + Chatwoot handoff |
| **4** | Admin UI (opcional) |

## Decisões registradas

- **Single-tenant por deploy** — não usar `tenant_id` até existir SaaS multi-cliente real.
- **Lead write determinístico** — IA não grava CRM diretamente.
- **Prompts em arquivo** — montados com `{{placeholders}}`; DB opcional na fase 2.
