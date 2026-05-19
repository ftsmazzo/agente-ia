# O que é gravado automaticamente

Cada mensagem inbound passa pela API (`POST /v1/chat`).

## Tabela `app.contacts` (cadastro do contato)

| Campo | Origem | Exemplo |
|-------|--------|---------|
| `phone` | Número do WhatsApp (DDI + DDD + número) | `5516998480805` |
| `display_name` | **pushName** do webhook Evolution; ou "me chamo X" na mensagem | `Maria Silva` |
| `source` | Fixo | `whatsapp` |
| `created_at` / `updated_at` | Automático | — |

**Atualização do nome:** se o contato já existe e chega um `pushName` novo, o nome é **atualizado**. Se não houver nome no webhook, mantém o que já estava.

O nome da **agenda do celular** só aparece se o WhatsApp/Evolution enviar `pushName` (nome público do perfil). Não é o mesmo que "nome salvo no telefone" em todos os casos.

## Tabela `app.lead_actions` (interesse em imóvel)

Gravado quando a mensagem indica interesse ou traz código `AP1234`:

| Campo | Exemplo |
|-------|---------|
| `phone` | `5516998480805` |
| `property_code` | `AP0868` ou `null` |
| `status` | `qualification` |

## Tabela `app.message_events` (auditoria)

Cada mensagem recebida e cada resposta planejada — para suporte e debug.

Desde a v0.15, `metadata.text` guarda o corpo da mensagem (cliente ou bot), visível no portal em **Conversas**.

## `lead_actions.metadata.qualification`

Quando o cliente menciona na mensagem (extração determinística):

| Campo | Exemplo |
|-------|---------|
| `budget_max_brl` | 300000 |
| `payment` | `financing`, `cash`, `fgts` |
| `buying_with` | `alone`, `couple`, `family` |
| `timeline_hint` | "em 30 dias" |
| `visit_requested` | true |
| `income_hint` | trecho da mensagem |

## `app.conversation_state`

| Modo | Comportamento |
|------|----------------|
| `bot` | SofIA responde |
| `human` | Bot silencia; corretor no Chatwoot |
| `paused` | Igual human (pausa temporária) |

## O que **não** grava ainda

- Endereço, e-mail, CPF completos (só bairro na conversa)
- Nome extraído por IA da conversa inteira
