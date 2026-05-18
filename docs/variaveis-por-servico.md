# Variáveis por serviço — mapa único (Pazotti / agente-ia)

**Use este arquivo como referência oficial.** Evite copiar o `.env.example` inteiro em cada serviço — muitas variáveis lá são só da API ou só do n8n.

Última revisão: alinhado ao código em `main` (API v0.10.x).

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
| **agente-ia** (API) | Marca, LLM, RAG, Postgres, Redis, debounce, prompts |
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

## 1. API `agente-ia` (EasyPanel → Environment)

Todas são lidas pelo processo Node em `apps/api`. Arquivo modelo: [`.env.example`](../.env.example).

### Obrigatórias

| Variável | Exemplo | Descrição |
|----------|---------|-----------|
| `BRAND_NAME` | `Pazotti Imóveis` | Nome da marca |
| `BRAND_SLUG` | `pazotti` | Identificador único |
| `ASSISTANT_NAME` | `SofIA` | Nome na conversa |
| `ASSISTANT_TITLE` | `consultora imobiliária` | Cargo |
| `DATABASE_URL` | `postgresql://user:pass@postgres:5432/realty` | Postgres (hostname interno) |
| `REDIS_URL` | `redis://redis:6379/0` | Redis |
| `API_INTERNAL_KEY` | *(string longa aleatória)* | Auth `X-API-Key` (n8n usa o mesmo valor como `AGENT_API_KEY`) |

### Marca e runtime

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `BRAND_WEBSITE` | — | Site (opcional) |
| `BRAND_PRIMARY_COLOR` | — | Hex (opcional) |
| `BRAND_LOGO_URL` | — | URL logo (opcional) |
| `DEFAULT_LOCALE` | `pt-BR` | Locale |
| `TIMEZONE` | `America/Sao_Paulo` | Fuso (agenda e prompts) |
| `NODE_ENV` | `development` | `production` em produção |
| `PORT` | `3000` | Porta HTTP |
| `LOG_LEVEL` | `info` | Log Pino |
| `APP_VERSION` | `0.5.0` no health | Definido no Dockerfile (`0.10.0`) |

### Features (true/false)

| Variável | Padrão |
|----------|--------|
| `FEATURE_AUDIO_REPLY` | true |
| `FEATURE_SCHEDULING` | true |
| `FEATURE_PROPERTY_RAG` | true |
| `FEATURE_HUMAN_HANDOFF` | true |

### Prompts

| Variável | Padrão |
|----------|--------|
| `SYSTEM_PROMPT_PATH` | `/app/config/prompts/system.pt-BR.md` |
| `PERSONA_PROMPT_PATH` | `/app/config/prompts/persona.pt-BR.md` |

### Banco e startup

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `RUN_MIGRATIONS_ON_START` | `true` | Migrations ao subir |
| `DB_WAIT_MAX_ATTEMPTS` | `30` | Espera Postgres |
| `DB_WAIT_DELAY_MS` | `2000` | Intervalo entre tentativas |
| `APP_ROOT` | `/app` | Raiz no container (scripts) |

### Debounce (WhatsApp)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DEBOUNCE_MS` | `5000` | Silêncio após última msg antes do LLM |
| `DEBOUNCE_MAX_WAIT_MS` | `20000` | Teto de espera |

### LLM

| Variável | Descrição |
|----------|-----------|
| `LLM_PROVIDER` | `openai` ou `anthropic` |
| `LLM_MODEL` | Override do modelo |
| `LLM_MAX_TOKENS` | Ex.: `2500` (GPT-5*) |
| `CHAT_MAX_HISTORY_TURNS` | Ex.: `8` |
| `OPENAI_API_KEY` | Se provider OpenAI |
| `OPENAI_MODEL` | Ex.: `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` | Se provider Anthropic |
| `ANTHROPIC_MODEL` | Ex.: `claude-3-5-haiku-20241022` |
| `GOOGLE_AI_API_KEY` | Reservado (não é fluxo principal hoje) |

### RAG imóveis

| Variável | Descrição |
|----------|-----------|
| `RAG_API_URL` | Base da API RAG |
| `RAG_API_KEY` | Chave |
| `RAG_KNOWLEDGE_BASE_ID` | ID da KB (alias aceito: `RAG_KB_ID`) |
| `RAG_TOP_K` | Padrão `5` |
| `RAG_TOP_K_CRITERIA` | Padrão `10` (busca por perfil) |
| `RAG_TIMEOUT_MS` | Padrão `45000` |

### Produção / dev

| Variável | Produção |
|----------|----------|
| `RESET_DEV_DATA_ON_START` | **`false`** (apaga Postgres+Redis se `true`) |
| `ALLOW_DEV_DATA_RESET` | Só se precisar reset com `NODE_ENV=production` |
| `SENTRY_DSN` | Opcional |

### ⚠️ NÃO colocar na API (estão no `.env.example` por histórico)

Estas **não são lidas** pelo código da API hoje. Configurar no serviço correto:

| Variável no `.env.example` | Onde configurar de verdade |
|----------------------------|----------------------------|
| `EVOLUTION_BASE_URL` | **n8n** (`EVOLUTION_BASE_URL`) + painel Evolution |
| `EVOLUTION_INSTANCE` | Painel Evolution (nome da instância) |
| `CHATWOOT_BASE_URL` | Painel Evolution → integração Chatwoot |
| `CHATWOOT_ACCOUNT_ID` | Painel Evolution → Chatwoot |
| `CHATWOOT_API_TOKEN` | Painel Evolution → Chatwoot |
| `N8N_WEBHOOK_BASE_URL` | Documentação / lembrete (URL pública do n8n) |
| `APPOINTMENT_NOTIFY_PHONE` | **n8n** apenas |
| `PUBLIC_AGENT_API_URL` | **n8n** apenas (link `.ics` público) |

---

## 2. n8n (EasyPanel → Environment)

Arquivo modelo: [`n8n/env.easypanel.example`](../n8n/env.easypanel.example).

### Obrigatórias para workflows 01 e 04

| Variável | Exemplo | Workflow | Descrição |
|----------|---------|----------|-----------|
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | **`false`** | 01, 04 | Sem isso: `access to env vars denied` |
| `AGENT_API_URL` | `http://agent-ia:3000` | 01, 04 | Hostname **interno** do serviço API |
| `AGENT_API_KEY` | = `API_INTERNAL_KEY` | 01, 04 | Header `X-API-Key` |
| `EVOLUTION_BASE_URL` | `http://evolution:8080` | 01 | Fallback se webhook não traz `server_url` |
| `EVOLUTION_API_KEY` | *(apikey Evolution)* | 01 | Enviar texto WhatsApp |
| `DEBOUNCE_MS` | `5000` | 01 | Igual à API |

### Agenda (workflow 01)

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `APPOINTMENT_NOTIFY_PHONE` | Para alerta | WhatsApp corretor: só dígitos, com DDI `55...` |
| `PUBLIC_AGENT_API_URL` | Opcional | URL **pública** HTTPS da API (link `.ics`). Se vazio, usa `AGENT_API_URL` (pode não abrir fora da rede) |

### Handoff Chatwoot (workflow 04)

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `CHATWOOT_INBOX_ID` | Opcional | Filtra só o inbox da SofIA (ex.: `1`) |

### Infra n8n (EasyPanel — não estão no repo)

Configure no painel do n8n conforme seu domínio:

| Variável típica | Uso |
|-----------------|-----|
| `WEBHOOK_URL` | URL pública base (`https://n8n.seudominio.com`) |
| `N8N_HOST` | Hostname público |
| `N8N_PROTOCOL` | `https` |

Webhooks usados pelos JSON importados:

| Workflow | Path padrão | URL completa |
|----------|-------------|--------------|
| `01-whatsapp-agent.json` | `whatsapp-agent` | `https://SEU-N8N/webhook/whatsapp-agent` |
| `04-sync-chatwoot.json` | `chatwoot-sync` | `https://SEU-N8N/webhook/chatwoot-sync` |

---

## 3. Evolution API

Configuração principal no **painel da instância** (não no repositório agente-ia).

| Onde | O quê |
|------|--------|
| Instância | Nome (ex.: usado no webhook `instance`) |
| Webhook | POST → `https://SEU-N8N/webhook/whatsapp-agent` |
| API Key | Mesma usada no n8n como `EVOLUTION_API_KEY` |
| Chatwoot (integração) | URL, Account ID, Token do inbox |

### Variável no container Evolution (self-hosted)

| Variável | Valor | Quando |
|----------|-------|--------|
| `CHATWOOT_ENABLED` | `true` | Se aparecer "Chatwoot is disabled" |

Campos Chatwoot (URL, token, account) são salvos **na Evolution**, não duplicar na API.

---

## 4. Chatwoot

| Onde | O quê |
|------|--------|
| Settings → Inboxes | **Account ID**, token API, nome do inbox |
| Settings → Integrations → Webhooks | URL `https://SEU-N8N/webhook/chatwoot-sync` |
| Eventos webhook | `message_created`, `conversation_status_changed`, `assignee_changed`, … |

Anote o **Inbox ID** numérico → `CHATWOOT_INBOX_ID` no n8n (opcional).

---

## 5. Postgres (serviço Docker)

| Variável (container Postgres) | Valor dev local |
|-------------------------------|-----------------|
| `POSTGRES_USER` | `realty` |
| `POSTGRES_PASSWORD` | `realty` |
| `POSTGRES_DB` | `realty` |

Na API use: `DATABASE_URL=postgresql://realty:realty@postgres:5432/realty` (ajuste user/senha/host).

---

## 6. Redis (serviço Docker)

Sem env especial no app — só `REDIS_URL` na API.

Ex.: `redis://redis:6379/0` (rede interna).

---

## 7. RAG (serviço externo)

Nenhuma variável no Evolution/Chatwoot. Só na **API**:

`RAG_API_URL`, `RAG_API_KEY`, `RAG_KNOWLEDGE_BASE_ID`, `FEATURE_PROPERTY_RAG=true`.

---

## Checklist de reimplantação (copiar e marcar)

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

## Arquivos relacionados

| Arquivo | Conteúdo |
|---------|----------|
| [`.env.example`](../.env.example) | Modelo **só API** (limpo) |
| [`n8n/env.easypanel.example`](../n8n/env.easypanel.example) | Modelo **só n8n** |
| [`environment-variables.md`](./environment-variables.md) | Índice curto → este documento |
| [`n8n-integracao.md`](./n8n-integracao.md) | Passo a passo workflow 01 |
| [`handoff-chatwoot.md`](./handoff-chatwoot.md) | Workflow 04 |
| [`operations-production.md`](./operations-production.md) | Checklist produção |
