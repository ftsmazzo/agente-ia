# Chatwoot + Evolution — guia de teste (Pazotti)

Passo a passo para conectar o Chatwoot na Evolution e conviver com a **SofIA** (n8n + API).

## Arquitetura no teste

```text
Cliente (WhatsApp)
    → Evolution (número conectado)
         ├→ Chatwoot (gestor / corretor respondem)
         └→ Webhook → n8n → API (SofIA)  [se modo = bot]
```

As duas pontas recebem mensagens. Sem `mode: human` na API, a SofIA **pode** responder junto com o corretor.

---

## 1. Pré-requisitos

| Serviço | O que precisa |
|---------|----------------|
| **Chatwoot** | Conta criada, inbox **API** ou canal que a Evolution use |
| **Evolution** | Instância WhatsApp **conectada** (QR ok) |
| **API agente-ia** | v0.9.0+, `/health` ok |
| **n8n** | Workflow `01-whatsapp-agent` ativo (SofIA) |
| **Rede EasyPanel** | Evolution, Chatwoot, n8n e API na **mesma rede** Docker |

No Chatwoot (Settings → Inboxes): anote **Account ID** e o **token** do inbox (ou token de usuário admin com permissão).

URL do Chatwoot **sem barra no final**, ex.: `https://chatwoot.seudominio.com` ou `http://chatwoot:3000` (interno).

---

## 2. Configurar na Evolution

### Painel / Manager

Na instância WhatsApp → integração **Chatwoot**:

| Campo | Valor |
|-------|--------|
| Enabled | `true` |
| URL | URL base do Chatwoot |
| Account ID | ID da conta |
| Token | Token do inbox / API |
| Inbox name | Ex.: `Pazotti WhatsApp` |
| Sign msg | Opcional (assinatura do agente) |
| Reopen conversation | `true` (recomendado) |
| **Conversation Pending** | **`false`** (se ligado, conversas ficam em **Pendente**, não em Abertas) |
| Merge Brazil contacts | `true` (recomendado para BR) |

### API (alternativa)

`POST /chatwoot/set/{nomeDaInstancia}` — ver [documentação Evolution Chatwoot](https://doc.evolution-api.com/v2/api-reference/integrations/chatwoot/set-chatwoot).

### Evolution self-hosted

Se aparecer *"Chatwoot is disabled"*, defina no container Evolution:

```env
CHATWOOT_ENABLED=true
```

---

## 3. Teste de conexão (sem SofIA ainda)

1. Envie uma mensagem **de outro celular** para o número da instância.
2. No **Chatwoot**, a conversa deve aparecer no inbox.
3. Responda **pelo Chatwoot** — o cliente deve receber no WhatsApp.

Se isso falhar, ajuste Evolution ↔ Chatwoot antes de misturar com a SofIA.

---

## 4. Conviver com a SofIA (importante)

### Enquanto o corretor atende no Chatwoot

Antes de atribuir / responder como humano, coloque o número em modo humano na API:

```bash
curl -X POST http://agent-ia:3000/v1/conversation/mode \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SEU_API_INTERNAL_KEY" \
  -d '{
    "phone": "5516999999999",
    "mode": "human",
    "reason": "chatwoot_test"
  }'
```

Use só dígitos no `phone` (DDI + DDD + número).

**Efeito:** n8n continua rodando, mas `/v1/chat` retorna `shouldReply: false` → SofIA **não** manda texto.

### Quando quiser SofIA de novo

```json
{ "phone": "5516999999999", "mode": "bot", "reason": "chatwoot_resolved" }
```

Ou o cliente escreve: *"voltar ao bot"*.

### Consultar modo

```bash
curl "http://agent-ia:3000/v1/conversation?phone=5516999999999" \
  -H "X-API-Key: SEU_API_INTERNAL_KEY"
```

---

## 5. Cenários de teste sugeridos

| # | O que fazer | Resultado esperado |
|---|-------------|-------------------|
| 1 | Msg no WhatsApp, modo `bot` | Chatwoot mostra + SofIA responde |
| 2 | Atribuir corretor no Chatwoot + `mode: human` | Só corretor responde |
| 3 | Cliente: *"quero falar com corretor"* | SofIA confirma + modo `human` |
| 4 | Corretor responde no Chatwoot com modo `human` | Sem segunda mensagem da SofIA |
| 5 | Resolver conversa + `mode: bot` | SofIA volta na próxima msg |

---

## 6. “Não aparece no Chatwoot” mas o log mostra mensagem

Se no log do Chatwoot aparece `POST .../messages` com `"Bom dia"` e IP `172.18.0.1` (Evolution), a bridge **funciona**.

Causa mais comum no painel:

| No Chatwoot | O que fazer |
|-------------|-------------|
| Aba **Abertas** + filtro **Atribuídas a mim** | Troque para **Pendente** ou **Todas** / **Não atribuídas** |
| Evolution com **Conversation Pending = ligado** | Desligue — conversas vão para fila **Pendente** |

Nos seus logs (15:07:39 UTC), a Evolution criou a conversa do Frederico com `"status" => "pending"` — por isso não aparecia em `status=open`.

## 7. Problemas comuns

| Sintoma | Causa provável |
|---------|----------------|
| Nada no Chatwoot | URL/token/account errados; `CHATWOOT_ENABLED` |
| Cliente não recebe resposta do Chatwoot | Instância desconectada; inbox errado |
| **Duas respostas** (SofIA + corretor) | Modo ainda `bot` — chamar `/conversation/mode` |
| SofIA não responde | Modo `human`; ou n8n/Evolution webhook parado |
| Telefone não bate na API | Chatwoot usa `+55...`; API usa só dígitos `5516...` |

---

## 7. Handoff automático (webhook)

Importe e ative: **`n8n/workflows/04-sync-chatwoot.json`**

Passo a passo completo: [handoff-chatwoot.md](./handoff-chatwoot.md)

Resumo: Chatwoot webhook → URL `.../webhook/chatwoot-sync` → API `POST /v1/conversation/mode`.
