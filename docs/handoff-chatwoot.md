# Handoff humano e Chatwoot

## O que já funciona (API)

### Pedido pelo WhatsApp

Frases como *"quero falar com um corretor"*:

1. Modo da conversa → `human` em `app.conversation_state`
2. SofIA responde uma vez confirmando que a equipe assume
3. Mensagens seguintes: `shouldReply: false`, `reason: human_handoff` (bot silencia)

*"voltar ao bot"* / *"pode ser a SofIA"* → modo `bot` de novo.

### API para n8n / Chatwoot

`POST /v1/conversation/mode` (header `X-API-Key`)

```json
{
  "phone": "5516999999999",
  "mode": "human",
  "assigneeRef": "chatwoot-agent-42",
  "reason": "chatwoot_assign"
}
```

`GET /v1/conversation?phone=5516999999999` — consulta modo atual.

## Conectar Evolution ↔ Chatwoot (teste)

Guia passo a passo: **[chatwoot-evolution-setup.md](./chatwoot-evolution-setup.md)**

## Integração Chatwoot (automação)

Workflow: **`n8n/workflows/04-sync-chatwoot.json`**

### 1. Importar no n8n

1. n8n → **Workflows** → **Import from file** → `04-sync-chatwoot.json`
2. **Publicar** o workflow (botão **Publish** no canto superior direito — obrigatório no n8n 2.x)
3. Ligar o toggle **Active** (verde)
4. Abrir o nó **Webhook Chatwoot** e copiar a URL de **produção** (não a de teste), ex.:
   `https://SEU-N8N/webhook/chatwoot-sync`

Se o workflow não estiver **Active**, o Chatwoot recebe **404** e o n8n mostra **zero execuções**.

Teste rápido (deve retornar HTTP 200, não 404):

```bash
curl -X POST "https://SEU-N8N/webhook/chatwoot-sync" \
  -H "Content-Type: application/json" \
  -d '{"event":"message_created","conversation":{"inbox_id":1,"meta":{"sender":{"phone_number":"+5516996480805"}}},"message":{"sender_type":"user","message_type":"outgoing"}}'
```

### 2. Variáveis no n8n (mesmas do workflow 01)

| Variável | Exemplo |
|----------|---------|
| `AGENT_API_URL` | `http://agent-ia:3000` (rede Docker) |
| `AGENT_API_KEY` | igual a `API_INTERNAL_KEY` da API |
| `CHATWOOT_INBOX_ID` | *(opcional)* `1` — só inbox SofIA |

### 3. Webhook no Chatwoot

**Settings → Integrations → Webhooks → Add new webhook**

| Campo | Valor |
|-------|--------|
| URL | URL do n8n acima |
| Eventos | **`message_created`** (obrigatório se corretor responde sem atribuir), `conversation_status_changed`, `assignee_changed`, `conversation_updated` |

### 4. O que o workflow faz

| Evento Chatwoot | API |
|-----------------|-----|
| Conversa **atribuída** a agente | `mode: "human"` |
| Status **resolved** | `mode: "bot"` |
| Corretor envia mensagem no painel (`message_created`, outgoing + user, sem `source_id`) | `mode: "human"` |

Telefone: extrai de `meta.sender.phone_number` (+55 → só dígitos).

**Importante:** mensagens da **SofIA pela Evolution** podem chegar ao Chatwoot como `message_created` / `outgoing` / `User`, mas com `source_id` externo (ex.: `WAID...`). O workflow ignora essas mensagens para não trocar `bot` → `human` depois de toda resposta automática. Mensagem digitada no painel do Chatwoot normalmente vem sem `source_id` e ainda troca para `human`.

### 5. Conferir se a API tem o endpoint (antes do handoff)

No EasyPanel, serviço **agent-ia** (mesmo hostname do `AGENT_API_URL`):

```bash
curl -s http://agent-ia:3000/health
```

Procure `"version": "0.9.0"` (ou superior) e `"humanHandoff": true` em `features`.

Teste o endpoint (troque a key):

```bash
curl -X POST http://agent-ia:3000/v1/conversation/mode \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SUA_API_INTERNAL_KEY" \
  -d '{"phone":"5516996480805","mode":"human","reason":"test"}'
```

- **200** `{"ok":true,...}` → API pronta; ajuste só n8n/env.
- **404** `Route POST:/v1/conversation/mode not found` → **rebuild/redeploy** da API com código ≥ v0.9.0.

### 6. Teste rápido (handoff completo)

1. Cliente com modo `bot` — confirme com `GET /v1/conversation?phone=...`
2. No Chatwoot: **atribuir** conversa a você
3. n8n → **Executions** — execução verde; API retorna `{ "ok": true, "mode": "human" }`
4. Cliente manda mensagem no WhatsApp → SofIA **não** responde
5. **Resolver** conversa → modo volta a `bot`; próxima msg do cliente → SofIA responde

### 7. Problemas comuns

| Sintoma | Causa | Solução |
|---------|--------|---------|
| **Zero execuções** no n8n | Workflow não **Active** / não **Publish** | Publish + Active; testar curl acima |
| curl retorna 404 `not registered` | Workflow n8n inativo | **Publish** + **Active** |
| n8n OK, nó API: `Route POST:/v1/conversation/mode not found` | API em produção **antiga** (sem v0.9.0) ou `AGENT_API_URL` errado | Redeploy `agent-ia`; conferir `/health` → `version` ≥ `0.9.0` e `features.humanHandoff` |
| Campos `{{ $env.AGENT_API_URL }}` com erro vermelho | `N8N_BLOCK_ENV_ACCESS_IN_NODE` | Definir `false` no n8n e **reiniciar** o container |
| Execução verde mas para no IF | Evento sem regra (ex. só `updated_at`) | Marcar **`message_created`** no Chatwoot; ou **atribuir** conversa |
| SofIA responde junto com corretor | Modo ainda `bot` | Webhook não chegou ou evento errado |
| SofIA responde e logo muda para `human` sozinha | Workflow confundindo mensagem automática espelhada pela Evolution com humano | Reimportar `04-sync-chatwoot.json` atualizado; ele ignora `message_created` com `source_id` |

Mais: [chatwoot-evolution-setup.md](./chatwoot-evolution-setup.md) seção 7.

## Qualificação no CRM

Campos extraídos da **mensagem do cliente** (regex), gravados em `lead_actions.metadata.qualification`:

- `budget_max_brl`, `payment`, `buying_with`, `timeline_hint`, `visit_requested`, `income_hint`

Consulta:

```sql
SELECT phone, property_code, metadata->'qualification'
FROM app.lead_actions
WHERE phone = '5516...'
ORDER BY updated_at DESC;
```
