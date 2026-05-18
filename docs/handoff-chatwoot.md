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

## Integração Chatwoot (automação — próximo passo)

1. Evolution bridge → Chatwoot (inbox WhatsApp).
2. Quando corretor **atribuir** conversa no Chatwoot, n8n ou webhook chama:
   `POST /v1/conversation/mode` com `mode: "human"`.
3. Quando resolver/fechar no Chatwoot:
   `mode: "bot"` para SofIA voltar.

Workflow `04-sync-chatwoot.json` — planejado no repo.

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
