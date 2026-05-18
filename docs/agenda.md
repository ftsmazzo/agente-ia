# Agenda própria

A agenda oficial da SofIA fica no Postgres. Não depende de Cal.com, Google Cloud ou OAuth.

## Fluxo

1. Cliente pede visita ou horário pelo WhatsApp.
2. `/v1/chat` consulta horários reais em `app.appointment_settings` + `app.appointments`.
3. SofIA oferece somente os slots disponíveis.
4. Cliente escolhe uma opção.
5. API valida o slot novamente e grava em `app.appointments`.
6. n8n envia a confirmação ao cliente e notifica o corretor.

## Regras padrão

| Campo | Padrão |
|-------|--------|
| Timezone | `America/Sao_Paulo` |
| Dias | segunda a sexta |
| Horário | 09:00–18:00 |
| Duração | 60 min |
| Antecedência mínima | 120 min |
| Janela ofertada | 7 dias |
| Local | `Sede da imobiliária` |

Esses valores ficam em `app.appointment_settings` e serão editáveis pela futura UI administrativa.

## Endpoints

Todas as rotas usam `X-API-Key`.

### `GET /v1/scheduling/settings`

Retorna a configuração atual da agenda.

### `GET /v1/scheduling/slots?days=7&limit=5`

Retorna horários disponíveis já descontando agendamentos ativos.

### `POST /v1/scheduling/book`

Agenda um slot se ele ainda estiver disponível.

```json
{
  "phone": "5516996480805",
  "startsAt": "2026-05-19T13:00:00.000Z",
  "customerName": "Frederico Mazzo",
  "propertyCode": "AP0868"
}
```

Resposta:

```json
{
  "ok": true,
  "appointment": {
    "id": 1,
    "phone": "5516996480805",
    "startsAt": "2026-05-19T13:00:00.000Z",
    "location": "Sede da imobiliária"
  }
}
```

Se outro cliente reservar antes, retorna `409 slot_unavailable` com novas opções.

### `GET /v1/scheduling/appointments`

Lista agendamentos para a futura UI administrativa.

Filtros opcionais:

- `status=scheduled`
- `from=2026-05-19T00:00:00.000Z`
- `to=2026-05-20T00:00:00.000Z`
- `limit=100`

### `PATCH /v1/scheduling/appointments/:id`

Atualiza status ou observação:

```json
{
  "startsAt": "2026-05-20T13:00:00.000Z",
  "status": "cancelled",
  "notes": "Cliente pediu remarcação"
}
```

Status possíveis: `scheduled`, `confirmed`, `cancelled`, `completed`, `no_show`.

Se `startsAt` for enviado, a API valida disponibilidade antes de remarcar. Se o horário estiver ocupado, retorna `409 slot_unavailable`.

### `GET /v1/scheduling/appointments/:id/ics`

Baixa o arquivo `.ics` para adicionar manualmente em Google Calendar, Apple Calendar ou Outlook.

Importante: `.ics` manual não é sincronização bidirecional. A fonte oficial continua sendo o Postgres.

## n8n

O workflow `01-whatsapp-agent.json` notifica o corretor quando `/v1/chat` retorna `appointmentBooked`.

Variáveis no n8n:

| Variável | Descrição |
|----------|-----------|
| `APPOINTMENT_NOTIFY_PHONE` | WhatsApp do corretor que recebe alerta imediato |
| `PUBLIC_AGENT_API_URL` | URL pública da API para link `.ics` (opcional) |

Se `PUBLIC_AGENT_API_URL` não existir, o workflow usa `AGENT_API_URL` no texto do link.

**Não recebeu o alerta?** Confira no EasyPanel (serviço n8n): `APPOINTMENT_NOTIFY_PHONE` preenchido (só dígitos, com DDI) e `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`. Reimporte o workflow `01-whatsapp-agent.json` após atualizar o repositório.

## Segurança contra alucinação

A LLM não decide disponibilidade. A API injeta um bloco `[AGENDA DO SISTEMA]` e também intercepta o fluxo de agendamento:

- Só oferece slots calculados pela API.
- Só confirma se o horário escolhido ainda estiver livre.
- Se o cliente pede outro horário, a SofIA oferece opções reais ou diz que vai verificar.

## Teste manual

1. Cliente manda: `Quero agendar uma visita`.
2. SofIA responde com opções numeradas.
3. Cliente responde: `opção 1`.
4. API grava em `app.appointments`.
5. n8n envia WhatsApp para `APPOINTMENT_NOTIFY_PHONE`.
6. `GET /v1/scheduling/slots` não mostra mais aquele horário.
