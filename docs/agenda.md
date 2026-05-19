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

Esses valores ficam em `app.appointment_settings` e são editáveis no **Portal → Agenda** (horário comercial).

### Vagas por horário (`slotCapacity`)

Por padrão **1** agendamento por horário (imobiliária: um cliente por slot). Para barbearia, clínica ou equipe com vários atendentes no mesmo horário, defina **Vagas por horário** (ex.: `3` = até três visitas às 10:00). O sistema conta agendamentos ativos (`scheduled` / `confirmed`) no mesmo `starts_at` e só bloqueia quando atingir o limite.

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

Atualiza status, confirmação operacional ou observação:

```json
{
  "startsAt": "2026-05-20T13:00:00.000Z",
  "status": "cancelled",
  "confirmationStatus": "confirmed",
  "notes": "Cliente pediu remarcação"
}
```

Status possíveis: `scheduled`, `confirmed`, `cancelled`, `completed`, `no_show`.

**Confirmação operacional** (`confirmationStatus`): `pending`, `confirmed`, `declined` — usada no portal para organizar visitas após o lembrete ~24h antes.

Se `startsAt` for enviado, a API valida disponibilidade antes de remarcar. Se o horário estiver ocupado, retorna `409 slot_unavailable`.

### `GET /v1/scheduling/appointments/:id/ics`

Baixa o arquivo `.ics` para adicionar manualmente em Google Calendar, Apple Calendar ou Outlook.

Importante: `.ics` manual não é sincronização bidirecional. A fonte oficial continua sendo o Postgres.

## Portal — Agenda

A tela **Agenda** no portal lista visitas (próximas, pendentes de confirmação, passadas) e permite **Confirmar visita**, **Recusar** ou **Cancelar** sem depender do WhatsApp.

## Lembretes e alertas (n8n)

O workflow `06-ops-notifications.json` roda a cada **30 minutos**, chama `POST /v1/ops/notifications/tick` e envia WhatsApp quando houver:

| Tipo | Destino | Quando |
|------|---------|--------|
| Lembrete ~24h | **Somente o cliente** (telefone da visita) | Visita daqui a **20–28 h**, `confirmation_status = pending` |
| Lembrete “em breve” | **Somente o cliente** | Visita daqui a **1–20 h**, só 1x |
| Erro novo | Operacional (`OPS_NOTIFY_PHONE`) | `app.failed_messages` — **não** é lembrete de visita |
| Resumo | Operacional | 10+ falhas não resolvidas |

O **corretor/usuário do portal não recebe** lembrete de visita (não confirma agenda pelo portal). O cliente recebe mensagem acolhedora com *SIM* / *NÃO*; a SofIA confirma ou cancela no `/v1/chat`.

**Remarcação:** ao mudar `starts_at`, o sistema zera `reminder_24h_sent_at` e volta `confirmation_status` para `pending`, para o cron poder enviar lembrete de confirmação do **novo** horário (o lembrete do horário antigo não vale mais).

**Importante:** reimporte `06-ops-notifications.json` após atualizar — o workflow antigo mandava tudo para `OPS_NOTIFY_PHONE` / `APPOINTMENT_NOTIFY_PHONE`.

Variáveis no n8n:

| Variável | Descrição |
|----------|-----------|
| `OPS_NOTIFY_PHONE` | Destino dos **alertas de erro** (opcional: usa `APPOINTMENT_NOTIFY_PHONE`) |
| `PORTAL_PUBLIC_URL` | URL do portal (link no lembrete de confirmação) |
| `PUBLIC_AGENT_API_URL` | URL da API (tick) |
| `AGENT_API_KEY` | Igual `API_INTERNAL_KEY` |
| `EVOLUTION_BASE_URL` | Igual no agente-ia (rede interna, ex. `http://evolution:8080`) |
| `EVOLUTION_API_KEY` | Igual no agente-ia |
| `EVOLUTION_INSTANCE` | **Obrigatório no n8n** — nome exato da instância (ex. `Teste`). O workflow 01 pega do webhook; o **06 não**. |

O workflow `01-whatsapp-agent.json` notifica o corretor **na hora** quando `/v1/chat` retorna `appointmentBooked`.

| Variável | Descrição |
|----------|-----------|
| `APPOINTMENT_NOTIFY_PHONE` | WhatsApp do corretor (só no **n8n**) |
| `APPOINTMENT_OFFICE_ADDRESS` | Endereço completo (na **API**) — confirmação + alerta |
| `APPOINTMENT_OFFICE_MAPS_URL` | Link Maps (opcional; senão gera do endereço) |
| `PUBLIC_AGENT_API_URL` | Domínio **público da API** (mesmo que abre `/health` no navegador) — link `.ics` |

O texto do alerta ao corretor é montado pela API (`appointmentNotifyText`); o n8n só envia no WhatsApp.

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
