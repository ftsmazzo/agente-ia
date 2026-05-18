# Debounce de mensagens WhatsApp

Evita várias respostas quando o cliente manda várias mensagens seguidas (“bom dia” + “centro” + “2 quartos”).

## Fluxo

```text
Evolution → n8n → POST /v1/debounce/wait-and-merge (aguarda ~3s no Redis)
  → se process=true → POST /v1/chat → Evolution sendText
  → se process=false (superseded) → fim (outra execução responde)
```

A lógica usa o **mesmo Redis** da API (`REDIS_URL`).

**Modo silêncio:** a resposta só sai após `DEBOUNCE_MS` **sem nenhuma mensagem nova** do mesmo número (quem demora para digitar a última linha não recebe duas respostas).

## Variáveis

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DEBOUNCE_MS` | `5000` | Ms de silêncio após a última mensagem antes de chamar o LLM |
| `DEBOUNCE_MAX_WAIT_MS` | `20000` | Teto de espera (evita n8n pendurado) |

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
