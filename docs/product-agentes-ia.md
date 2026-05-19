# Pacote produto: agentes-ia

Um deploy = uma empresa. O pacote **agentes-ia** agrupa tudo que está funcional hoje: WhatsApp, catálogo, RAG, agenda, lembretes ao cliente e handoff.

## Onde está definido

| Artefato | Caminho |
|----------|---------|
| Manifesto (fonte da verdade) | `config/product/agentes-ia.manifest.json` |
| Blocos de prompt por função | `config/capabilities/*.md` |
| Env por serviço | `env-templates/01-agente-ia.env`, `02-n8n.env` |
| Workflows n8n | `n8n/workflows/` |

## Funções (portal → prompt)

No **Portal → Personalizar agente**, os checkboxes ligam blocos no prompt interno:

| ID | O que faz |
|----|-----------|
| `catalog` | Códigos AP#### e catálogo Postgres |
| `property-rag` | Fichas via RAG externo |
| `scheduling` | Agenda e remarcação no WhatsApp |
| `visit-reminders` | Lembretes SIM/NÃO (depende de agenda) |
| `handoff` | Transferência para humano / Chatwoot |

**Infra (não é checkbox):** `whatsapp-core` — workflow `01-whatsapp-agent.json` + Evolution.

Guia passo a passo (nova empresa): **[instalacao-nova-empresa.md](./instalacao-nova-empresa.md)**  
Checklist no terminal: `npm run product:install-checklist -- "Nome da Empresa"`  
Workflows n8n: **[n8n/workflows/INSTALL.md](../n8n/workflows/INSTALL.md)**

## Instalação guiada (EasyPanel — sem um clique)

### 1. API (agente-ia)

Cole `env-templates/01-agente-ia.env`. Mínimo:

- `FEATURE_SCHEDULING=true`, `FEATURE_PROPERTY_RAG=true`, `FEATURE_HUMAN_HANDOFF=true`
- `DATABASE_URL`, `REDIS_URL`, `API_INTERNAL_KEY`, LLM, RAG_*

### 2. n8n

Cole `env-templates/02-n8n.env`. Importe e **ative**:

| Ordem | Workflow | Função |
|-------|----------|--------|
| 1 | `01-whatsapp-agent.json` | WhatsApp (obrigatório) |
| 2 | `06-ops-notifications.json` | Lembretes ao cliente |
| 3 | `04-sync-chatwoot.json` | Handoff (se usar Chatwoot) |

Pares iguais: `API_INTERNAL_KEY` (API) = `AGENT_API_KEY` (n8n).

### 3. Evolution

`env-templates/03-evolution.env` — webhook apontando para n8n `/webhook/whatsapp-agent`.

### 4. Conferir no portal

`GET /v1/portal/product/agentes-ia` (autenticado) devolve catálogo de funções + status de instalação (`install[]`).

## Comportamento vs infra

- **Desligar função no portal** → a IA deixa de seguir aquele bloco no prompt; o código pode ainda estar no servidor.
- **Desligar `FEATURE_*` no env** → a função não roda; o portal mostra aviso em `install`.

## Próximos passos (produto)

- Tela **Instalação** (role installer) com checklist do manifesto
- Validador `npm run product:validate` (env + workflows)
- Segundo pacote vertical sem duplicar código
