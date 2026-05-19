# Conversas no portal

Tela **Conversas** (`/conversas`) lista contatos que já interagiram pelo WhatsApp e exibe o histórico gravado em `app.message_events`.

## O que aparece

- **Lista:** telefone, nome (`app.contacts`), modo (`bot` / `human` / `paused`), prévia da última mensagem.
- **Detalhe:** bolhas com texto quando o evento tem `metadata.text`; eventos antigos sem texto mostram linha de sistema (`reason`, `status`).
- **Redis:** se a memória do agente (7 dias) tiver mais conteúdo que o banco, uma seção extra mostra os turnos do cache.

## A partir da v0.15

Cada chamada a `POST /v1/chat` grava o texto da mensagem do cliente e da resposta do bot em `message_events.metadata.text`. Deploys anteriores podem ter só metadados técnicos (sem corpo).

## API (portal autenticado)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/v1/portal/conversations?search=&limit=&offset=` | Lista conversas |
| GET | `/v1/portal/conversations/:phone` | Thread + `redisHistory` |

## Busca

Filtro por trecho do telefone (dígitos) ou nome do contato (`ILIKE` em `display_name`).
