# Variáveis por serviço — mapa único (Pazotti / agente-ia)

## Copiar e colar (EasyPanel)

**Pasta:** [`env-templates/`](../env-templates/)

| Arquivo | Cole no serviço EasyPanel |
|---------|---------------------------|
| [`01-agente-ia.env`](../env-templates/01-agente-ia.env) | API / agente-ia |
| [`02-n8n.env`](../env-templates/02-n8n.env) | n8n |
| [`03-evolution.env`](../env-templates/03-evolution.env) | Evolution |
| [`04-chatwoot.env`](../env-templates/04-chatwoot.env) | Anotações Chatwoot |
| [`05-postgres.env`](../env-templates/05-postgres.env) | Postgres |
| [`06-redis.env`](../env-templates/06-redis.env) | Redis → montar `REDIS_URL` na API |

Instruções: [`env-templates/LEIA-ME.txt`](../env-templates/LEIA-ME.txt)

Cada arquivo é `CHAVE=valor` — confronte com o Environment do painel, apague o que estiver no serviço errado (lista no final de cada `.env`).

Este `.md` é só diagrama, checklist e troubleshooting — **não cole tabelas daqui no EasyPanel.**

---

## Visão rápida

```text
WhatsApp ←→ Evolution ←→ webhook → n8n (workflows) ←→ API agente-ia
                ↓                              ↓
            Chatwoot                    Postgres + Redis
                ↑
         webhook n8n (04-sync-chatwoot)
```

| Serviço EasyPanel | O que configura |
|-------------------|-----------------|
| **Postgres** | Banco `realty` (usuário/senha → `DATABASE_URL` na API) |
| **Redis** | Cache/fila (`REDIS_URL` na API) |
| **agente-ia** (API) | Marca, LLM, RAG, Postgres, Redis, debounce, prompts, Evolution (portal WhatsApp) |
| **n8n** | Ponte Evolution ↔ API, alerta de visita, handoff Chatwoot |
| **Evolution** | WhatsApp + integração Chatwoot (painel ou API) |
| **Chatwoot** | Inbox, token, webhooks para n8n |
| **RAG** (externo) | Só URL/chave na API — serviço separado |

---

## Pares que DEVEM ser iguais

| Variável A | Serviço A | Variável B | Serviço B |
|------------|-----------|------------|-----------|
| `API_INTERNAL_KEY` | API | `AGENT_API_KEY` | n8n |
| `DEBOUNCE_MS` | API | `DEBOUNCE_MS` | n8n |
| `DEBOUNCE_MAX_WAIT_MS` | API | *(opcional)* | n8n usa só `DEBOUNCE_MS` no body; API usa os dois |

**Não duplique** `APPOINTMENT_NOTIFY_PHONE` na API — ela **só funciona no n8n**.

---

## Webhooks (URLs, não são env da API)

| Workflow | URL |
|----------|-----|
| Evolution → n8n | `https://SEU-N8N/webhook/whatsapp-agent` |
| Chatwoot → n8n | `https://SEU-N8N/webhook/chatwoot-sync` |

---

## Checklist de reimplantação

### API `agente-ia`

- [ ] `BRAND_*`, `ASSISTANT_*`, `TIMEZONE`
- [ ] `DATABASE_URL`, `REDIS_URL`
- [ ] `API_INTERNAL_KEY`
- [ ] `OPENAI_API_KEY` (+ `LLM_*` se necessário)
- [ ] `RAG_*` se imóveis ativos
- [ ] `DEBOUNCE_MS` = `5000` (ou valor escolhido)
- [ ] `RUN_MIGRATIONS_ON_START=true`
- [ ] `RESET_DEV_DATA_ON_START=false`
- [ ] `FEATURE_SCHEDULING=true`, `FEATURE_HUMAN_HANDOFF=true`
- [ ] `EVOLUTION_BASE_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` (portal WhatsApp)

### n8n

- [ ] `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` + **restart**
- [ ] `AGENT_API_URL`, `AGENT_API_KEY` (= API)
- [ ] `EVOLUTION_BASE_URL`, `EVOLUTION_API_KEY`
- [ ] `DEBOUNCE_MS` (= API)
- [ ] `APPOINTMENT_NOTIFY_PHONE` (alerta visita)
- [ ] `PUBLIC_AGENT_API_URL` (HTTPS público, opcional)
- [ ] `CHATWOOT_INBOX_ID` (se usar workflow 04)
- [ ] Workflows **01** e **04** importados e **ativos**

### Evolution

- [ ] Instância conectada (QR)
- [ ] Webhook → n8n `whatsapp-agent`
- [ ] Chatwoot integrado (`CHATWOOT_ENABLED` se preciso)

### Chatwoot

- [ ] Webhook → n8n `chatwoot-sync`

---

## Problemas comuns = variável no serviço errado

| Sintoma | Verificar |
|---------|-----------|
| SofIA não responde | n8n: `AGENT_API_URL`, workflow 01 ativo, Evolution webhook |
| `access to env vars denied` | n8n: `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` + restart |
| Dupla resposta WhatsApp | API e n8n: mesmo `DEBOUNCE_MS` |
| 401 na API | `AGENT_API_KEY` = `API_INTERNAL_KEY` |
| Sem alerta de visita | **n8n** `APPOINTMENT_NOTIFY_PHONE` (não na API) |
| Link ICS não abre | **n8n** `PUBLIC_AGENT_API_URL` (HTTPS público) |
| Handoff não funciona | Chatwoot webhook + n8n workflow 04 + `CHATWOOT_INBOX_ID` |
| Nada no Chatwoot | Evolution integração Chatwoot (não é env da API) |

---

## Docs relacionados

- [`n8n-integracao.md`](./n8n-integracao.md) — workflow 01
- [`handoff-chatwoot.md`](./handoff-chatwoot.md) — workflow 04
- [`operations-production.md`](./operations-production.md) — produção
