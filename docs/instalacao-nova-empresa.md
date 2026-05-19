# Instalação do zero — nova empresa (pacote agentes-ia)

Um deploy EasyPanel = **uma empresa** (ex.: Pazotti hoje; amanhã outra imobiliária).

Tempo realista: **2–4 h** na primeira vez; **~1 h** na segunda empresa (só trocar marca, env e QR WhatsApp).

---

## O que não dá para automatizar (ainda)

- EasyPanel não importa workflows n8n com um clique.
- Cada empresa precisa: Postgres/Redis (ou schema isolado), domínios, Evolution **instância**, env preenchido.

O que **já existe** no repo para facilitar:

| Recurso | Uso |
|---------|-----|
| `env-templates/0x-*.env` | Copiar/colar por serviço |
| `config/product/agentes-ia.manifest.json` | Lista funções + workflows + env |
| `n8n/workflows/*.json` | Import manual (3 arquivos) |
| `n8n/workflows/INSTALL.md` | Ordem e webhooks |
| Portal → Agente | Funções + aviso se falta env |
| `docs/variaveis-por-servico.md` | Mapa e troubleshooting |

---

## Fase 0 — Antes de subir containers

- [ ] Domínio ou subdomínio: API, portal, n8n, Evolution (públicos ou só internos na rede EasyPanel).
- [ ] Chave LLM (OpenAI ou Anthropic).
- [ ] Conta RAG (se usar fichas) — `RAG_KNOWLEDGE_BASE_ID` por empresa.
- [ ] Gerar **uma** chave interna (32+ bytes hex) → será `API_INTERNAL_KEY` e `AGENT_API_KEY`.
- [ ] Planilha de imóveis ou CSV (se usar catálogo).
- [ ] Telefone WhatsApp Business / número de teste.

---

## Fase 1 — Infra (mesmo projeto EasyPanel)

### 1.1 PostgreSQL

- Criar banco/usuário (ou serviço Postgres dedicado).
- Montar `DATABASE_URL` na API:
  `postgresql://USER:PASS@HOST:5432/DB?sslmode=disable`

### 1.2 Redis

- Serviço Redis.
- `REDIS_URL=redis://default:SENHA@HOST:6379`

### 1.3 Ordem de subida

1. Postgres + Redis  
2. **agente-ia** (API) — migrations rodam no start (`RUN_MIGRATIONS_ON_START=true`)  
3. **painel-ia** (portal)  
4. **Evolution**  
5. **n8n**  
6. (Opcional) Chatwoot  

---

## Fase 2 — API (agente-ia)

1. Abra `env-templates/01-agente-ia.env`.
2. Preencha **marca da nova empresa**:
   - `BRAND_NAME`, `BRAND_SLUG`, `ASSISTANT_NAME`, `TIMEZONE`
   - `FEATURE_SCHEDULING=true`, `FEATURE_PROPERTY_RAG=true`, `FEATURE_HUMAN_HANDOFF=true`
3. Cole `DATABASE_URL`, `REDIS_URL`, `API_INTERNAL_KEY`, chaves LLM e RAG.
4. `PORTAL_CORS_ORIGIN` = URL **exata** do portal (com `https://`).
5. `PUBLIC_AGENT_API_URL` = URL pública da API (para links `.ics`).
6. `EVOLUTION_*` na API (portal usa para QR/conectar WhatsApp).
7. `PORTAL_*` para criar admin no primeiro start (`PORTAL_ADMIN_*`).
8. Deploy → `GET https://SUA-API/health` deve retornar ok.

**Não** coloque no API: `APPOINTMENT_NOTIFY_PHONE`, `AGENT_API_KEY` (só n8n).

---

## Fase 3 — Portal (painel-ia)

1. Build arg / env: `PORTAL_API_URL` ou `VITE_API_URL` = URL pública da API.
2. Deploy.
3. Login com `PORTAL_ADMIN_EMAIL` / `PORTAL_ADMIN_PASSWORD`.
4. **Personalizar agente** → marque as 5 funções; salve.
5. **Agenda** → horário comercial, vagas por horário se precisar.
6. **Catálogo** → importe CSV/planilha (se usar catálogo).
7. (Opcional) Criar usuário cliente em usuários.

---

## Fase 4 — Evolution (WhatsApp)

1. `env-templates/03-evolution.env` — API key, instância.
2. Crie instância com nome **igual** a `EVOLUTION_INSTANCE` (ex.: `MinhaImobiliaria`).
3. Webhook da instância → URL do n8n (ver Fase 5):
   `https://SEU-N8N/webhook/whatsapp-agent`
4. No portal: **WhatsApp** → conectar QR (ou parear).

---

## Fase 5 — n8n (workflows)

Guia detalhado: [n8n/workflows/INSTALL.md](../n8n/workflows/INSTALL.md)

Resumo:

1. Env: `env-templates/02-n8n.env` — **mesmo** `AGENT_API_KEY` que `API_INTERNAL_KEY`.
2. `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` — obrigatório.
3. `EVOLUTION_INSTANCE` = mesmo nome da instância Evolution.
4. Importar JSON **nesta ordem**, ativar cada um:

| # | Arquivo | Webhook / gatilho |
|---|---------|-------------------|
| 1 | `01-whatsapp-agent.json` | `POST /webhook/whatsapp-agent` |
| 2 | `06-ops-notifications.json` | Cron 30 min (sem webhook) |
| 3 | `04-sync-chatwoot.json` | `POST /webhook/chatwoot-sync` (só se usar handoff) |

5. Reinicie o container n8n após mudar env.

---

## Fase 6 — Teste de instalação (checklist)

### Infra

- [ ] `/health` API ok  
- [ ] Login portal ok  
- [ ] Portal → Agente: funções sem aviso amarelo crítico  
- [ ] WhatsApp conectado (portal ou Evolution)

### Conversa

- [ ] Mensagem "oi" → resposta da SofIA  
- [ ] Código AP#### ou busca por bairro → usa catálogo/RAG  
- [ ] Aceitar visita → lista numerada de horários → escolher → confirmação  
- [ ] "Quero mudar a data" → remarcação com lista  
- [ ] Handoff: "quero falar com atendente" (se Chatwoot ligado)

### Agenda / lembretes

- [ ] Agendar visita com antecedência na janela 20–28 h (ou 1–20 h)  
- [ ] Cliente recebe lembrete SIM/NÃO (não o corretor)  
- [ ] Responder SIM → confirmado; NÃO → cancela e libera slot  

### Ops

- [ ] Nova visita → corretor recebe alerta (`APPOINTMENT_NOTIFY_PHONE` no n8n, workflow 01)  
- [ ] Desconectar/reconectar WhatsApp no portal (installer)

---

## Segunda empresa (clone)

| Trocar | Manter igual |
|--------|----------------|
| `BRAND_*`, `ASSISTANT_*` | Código do repo |
| `DATABASE_URL` (banco novo ou schema) | Estrutura workflows |
| `API_INTERNAL_KEY` novo | Arquivos JSON n8n |
| `RAG_KNOWLEDGE_BASE_ID` | Ordem de import |
| Evolution **nova instância** | |
| Domínios (ou mesmo projeto, outros serviços) | |
| Planilha/catálogo da empresa | |

**Não** misture duas empresas na mesma instância Evolution ou mesmo `BRAND_SLUG` no mesmo banco sem isolamento.

---

## Próximas melhorias no produto (roadmap)

1. **Tela Instalação** no portal (role installer) — checklist interativo lendo o manifesto.  
2. **Script** `node scripts/print-install-checklist.mjs` — imprime env/workflows por empresa.  
3. **Validador** pós-deploy — API checa variáveis críticas e responde JSON.  
4. (Futuro) API n8n para importar workflows — só se valer a complexidade.

---

## Referências

- [product-agentes-ia.md](./product-agentes-ia.md)  
- [variaveis-por-servico.md](./variaveis-por-servico.md)  
- [n8n-integracao.md](./n8n-integracao.md)  
- [agenda.md](./agenda.md)
