# Operação em produção (checklist)

Use após validar SofIA + RAG em ambiente de testes.

## 1. Variáveis da API (EasyPanel → Environment)

| Variável | Produção |
|----------|----------|
| `RESET_DEV_DATA_ON_START` | **`false`** (obrigatório) |
| `ALLOW_DEV_DATA_RESET` | Remover ou `false` |
| `NODE_ENV` | `production` |
| `OPENAI_API_KEY`, `RAG_API_KEY` | Só em **Environment**, nunca Build Args |
| `API_INTERNAL_KEY` | String longa aleatória; igual no n8n (`AGENT_API_KEY`) |
| `DEBOUNCE_MS` | `3000`–`5000` (janela entre mensagens seguidas) |
| `RAG_TIMEOUT_MS` | `45000` |

## 2. n8n

| Variável | Valor |
|----------|--------|
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | `false` |
| `AGENT_API_URL` | `http://agent-ia:3000` (hostname interno) |
| `DEBOUNCE_MS` | Mesmo valor da API (ex.: `3000`) |

Reimporte `n8n/workflows/01-whatsapp-agent.json` após atualizações (fluxo com debounce).

Webhook Evolution → URL do workflow ativo (`/webhook/whatsapp-agent`).

## 3. Health e alertas

```bash
curl -s https://SEU_DOMINIO/health | jq
```

Verifique:

- `status`: `"ok"`
- `version`: versão esperada (ex.: `0.8.0`)
- `checks.database` e `checks.redis`: `true`
- `ops.warnings`: **ausente** ou vazio em produção
- `ops.failed_messages_unresolved`: `0` (investigar se > 0)

Configure monitor externo (Uptime Kuma, EasyPanel health, etc.) em `GET /health` a cada 1–5 min.

## 4. Segurança

- Rotacione chaves se apareceram em logs de build.
- Não commite `.env` com secrets.
- API exposta só na rede interna; n8n/Evolution com autenticação.

## 5. Debounce (comportamento esperado)

Cliente envia várias linhas em sequência → **uma** resposta da SofIA após ~3 s da última mensagem.

Logs da API: `debounce wait-and-merge` com `process: true` e `messageCount` > 1 quando consolidou.

Execuções n8n “superseded” terminam sem chamar `/v1/chat` — é normal.

## 6. Rollback

- EasyPanel: redeploy da imagem/tag anterior.
- Migrations são forward-only; não apague `app.schema_migrations` sem orientação.
