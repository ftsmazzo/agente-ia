# Contrato da API

Base URL interna: `http://realty-api:3000` (Docker) ou `http://localhost:3000` (local).

Autenticação rotas `/v1/*`: header `X-API-Key: <API_INTERNAL_KEY>`.

## `GET /health`

Sem autenticação. Para load balancer e EasyPanel healthcheck.

**Resposta 200**

```json
{
  "status": "ok",
  "service": "realty-agent-api",
  "version": "0.1.0",
  "brand_slug": "example-realty",
  "features": {
    "audioReply": true,
    "scheduling": true,
    "propertyRag": true,
    "humanHandoff": true
  },
  "timestamp": "2026-05-16T12:00:00.000Z"
}
```

## `GET /v1/conversation?phone=5511999999999`

Consulta modo (`bot` | `human` | `paused`).

## `POST /v1/conversation/mode`

Altera modo (n8n, Chatwoot, painel interno).

```json
{
  "phone": "5511999999999",
  "mode": "human",
  "assigneeRef": "optional-chatwoot-id",
  "reason": "chatwoot_assign"
}
```

## `GET /v1/config/brand`

Retorna identidade pública (sem secrets).

## `POST /v1/debounce/wait-and-merge`

Chamado pelo n8n **antes** do chat. Aguarda `DEBOUNCE_MS` e consolida mensagens seguidas do mesmo telefone.

**Body:** igual ao `/v1/chat` + `debounceMs` opcional.

**Resposta 200**

```json
{
  "process": true,
  "merged": { "messageId": "...", "phone": "...", "message": "linha1\nlinha2" },
  "waitedMs": 3010,
  "reason": "ready",
  "messageCount": 2
}
```

Se `process: false` (`reason: "superseded"`), o n8n **não** chama `/v1/chat` nesta execução.

## `POST /v1/chat`

Chamado pelo n8n após debounce e idempotência.

**Body**

```json
{
  "messageId": "evolution-message-id",
  "phone": "5511999999999",
  "message": "Texto do cliente",
  "timestamp": 1715000000,
  "instance": "instance-name",
  "messageType": "text",
  "metadata": {}
}
```

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `messageId` | sim | ID único para idempotência |
| `phone` | sim | Apenas dígitos, com DDI |
| `message` | sim | Texto processado (ou transcrição) |
| `messageType` | não | `text` \| `audio` \| `image` \| `other` |

**Resposta 200**

```json
{
  "shouldReply": true,
  "replyText": "Mensagem para enviar no WhatsApp",
  "replyAudio": false,
  "conversationMode": "bot",
  "reason": "optional-code"
}
```

| Campo | Descrição |
|-------|-----------|
| `shouldReply` | Se `false`, n8n não envia WhatsApp (ex.: humano assumiu) |
| `replyText` | Texto quando `shouldReply=true` |
| `replyAudio` | Sugestão para n8n enviar áudio |
| `conversationMode` | `bot` \| `human` \| `paused` |
| `appointmentBooked` | Presente quando a SofIA confirmou uma visita; usado pelo n8n para notificar o corretor |

**Erros**

| Status | `error` |
|--------|---------|
| 400 | `validation_error` |
| 401 | `unauthorized` |
| 500 | `prompt_load_failed` |

## Agenda própria

Rotas internas para Postgres como fonte oficial da agenda. Todas usam `X-API-Key`.

| Rota | Uso |
|------|-----|
| `GET /v1/scheduling/settings` | Configuração atual da agenda |
| `GET /v1/scheduling/slots?days=7&limit=5` | Slots disponíveis |
| `POST /v1/scheduling/book` | Confirmar slot disponível |
| `GET /v1/scheduling/appointments` | Listagem para futura UI |
| `PATCH /v1/scheduling/appointments/:id` | Cancelar/concluir/remarcar por status |
| `GET /v1/scheduling/appointments/:id/ics` | Arquivo `.ics` manual |

Mais detalhes: [agenda.md](./agenda.md).

## Versionamento

Contrato versionado com o pacote `@realty/shared` (`chatRequestSchema`, `chatResponseSchema`).

Mudanças breaking incrementam versão na URL (`/v2/chat`) em releases futuros.
