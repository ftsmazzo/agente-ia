# Debounce de mensagens WhatsApp

Evita várias respostas quando o cliente manda várias mensagens seguidas (“bom dia” + “centro” + “2 quartos”).

## Fluxo

```text
Evolution → n8n → POST /v1/debounce/wait-and-merge (aguarda ~3s no Redis)
  → se process=true → POST /v1/chat → Evolution sendText
  → se process=false (superseded) → fim (outra execução responde)
```

A lógica usa o **mesmo Redis** da API (`REDIS_URL`).

## Variáveis

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DEBOUNCE_MS` | `3000` | Janela em ms após a última mensagem do burst |

No n8n, use o mesmo `DEBOUNCE_MS` no body (opcional; a API usa o env se omitir).

## Endpoint

`POST /v1/debounce/wait-and-merge`  
Header: `X-API-Key` (igual `/v1/chat`)

Body: mesmo schema do chat + `debounceMs` opcional.

Resposta:

```json
{
  "process": true,
  "merged": { "messageId": "...", "phone": "...", "message": "linha1\nlinha2", ... },
  "waitedMs": 3012,
  "reason": "ready",
  "messageCount": 3
}
```

Ou:

```json
{ "process": false, "reason": "superseded", "waitedMs": 3001 }
```

## Desativar debounce

No workflow n8n, ligue “Mensagem válida?” direto em “Chamar API Agente” (versão antiga sem debounce) — não recomendado em produção.
