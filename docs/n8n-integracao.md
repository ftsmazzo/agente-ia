# Integração n8n — Evolution → API → WhatsApp

Fase atual: workflow mínimo ponta a ponta (sem debounce/áudio — próxima iteração).

## Pré-requisitos

- API `agent-ia` com `/health` ok (`database` + `redis`)
- Evolution API com instância conectada
- n8n no **mesmo projeto/rede** EasyPanel que a API

## 1. Variáveis de ambiente no n8n

### Liberar `$env` no workflow (erro comum)

Se no editor aparecer **`[ERROR: access to env vars denied]`**, adicione no n8n:

```env
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

| Valor | Efeito |
|-------|--------|
| `false` | Permite `{{ $env.AGENT_API_URL }}` etc. (**necessário**) |
| `true` | Bloqueia acesso — padrão de segurança em alguns installs |

Depois de salvar: **reinicie o container n8n**.

> O aviso pode continuar no **preview** do nó até você **executar** o workflow — em runtime, com `false`, funciona.

Referência: [n8n Security env vars](https://docs.n8n.io/hosting/configuration/environment-variables/security/)

### Integração WhatsApp

No app **n8n** do EasyPanel, adicione (Environment, não Build Args):

| Variável | Exemplo | Descrição |
|----------|---------|-----------|
| `AGENT_API_URL` | `http://agent-ia:3000` | URL interna da API (nome do serviço EasyPanel) |
| `AGENT_API_KEY` | *(igual `API_INTERNAL_KEY` da API)* | Header `X-API-Key` |
| `EVOLUTION_BASE_URL` | `http://evolution:8080` | Base da Evolution |
| `EVOLUTION_API_KEY` | *(sua apikey)* | Header `apikey` na Evolution |

Modelo: [n8n/env.easypanel.example](../n8n/env.easypanel.example)

> **Dica:** o hostname é o **nome do serviço** no EasyPanel (ex.: `agent-ia`, `evolution`), não o domínio público.

## 2. Importar workflow

1. n8n → **Workflows** → **Import from File**
2. Arquivo: `n8n/workflows/01-whatsapp-agent.json`
3. Abra o workflow e confira os nós (credenciais usam `$env`)
4. **Activate** o workflow

## 3. Webhook na Evolution

URL de produção do n8n (ajuste domínio):

```text
https://SEU-N8N/webhook/whatsapp-agent
```

No Evolution, configure o webhook da instância para enviar eventos de **mensagens recebidas** para essa URL (POST).

Eventos esperados no body (padrão Evolution):

- `data.key.id` — ID da mensagem
- `data.key.remoteJid` — telefone
- `data.message.conversation` — texto
- `data.pushName` — **nome exibido no WhatsApp** (gravado em `app.contacts.display_name`)
- `instance` — nome da instância
- `server_url` — URL da Evolution

> Reimporte o workflow `01-whatsapp-agent.json` após atualizações para enviar `pushName` à API.

## 4. Fluxo do workflow

```text
Webhook → Normalizar → Filtro (não grupo / não fromMe)
  → POST /v1/chat (API)
  → Se shouldReply → Evolution sendText
```

A API já faz:

- Idempotência (`messageId`)
- Migrations automáticas
- Lead upsert (código imóvel AP####)
- Handoff humano (`conversation_mode` human/paused)

## 5. Testes

1. Envie WhatsApp para o número da instância.
2. No n8n → **Executions** — deve aparecer execução verde.
3. Resposta automática (ack fase 1) no WhatsApp.
4. Postgres: `SELECT * FROM app.message_events ORDER BY id DESC LIMIT 5;`

Teste manual da API (opcional):

```bash
curl -X POST http://agent-ia:3000/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: SEU_KEY" \
  -d '{"messageId":"manual-1","phone":"5511999999999","message":"AP0868"}'
```

## 6. Próximas iterações (roadmap)

| Item | Descrição |
|------|-----------|
| Debounce | Wait + Redis (várias mensagens → uma chamada API) |
| Áudio | Transcrição + resposta ElevenLabs |
| Erro global | Workflow `05-error-notify` |
| Chatwoot | Bridge + handoff visual |
| LLM | Motor SofIA na API (fase 2) |

## 7. Problemas comuns

| Sintoma | Solução |
|---------|---------|
| `ECONNREFUSED` na API | `AGENT_API_URL` com hostname interno correto |
| 401 na API | `AGENT_API_KEY` = `API_INTERNAL_KEY` |
| Webhook não dispara | URL pública HTTPS, workflow ativo, Evolution apontando certo |
| Sem resposta WhatsApp | Ver execução n8n; `shouldReply` false? Evolution apikey? |
| Duplicata | Normal — API retorna `duplicate_message` na 2ª vez |
| `access to env vars denied` | `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` + restart n8n |
