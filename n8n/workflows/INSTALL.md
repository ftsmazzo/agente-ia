# Instalação dos workflows n8n (pacote agentes-ia)

Importe do repositório — **não** edite URLs fixas nos nós; tudo usa `$env`.

## Pré-requisitos no serviço n8n

```env
N8N_BLOCK_ENV_ACCESS_IN_NODE=false

AGENT_API_URL=http://NOME-DO-SERVICO-API:3000
AGENT_API_KEY=...          # = API_INTERNAL_KEY da API
PUBLIC_AGENT_API_URL=https://api.suaempresa.com

EVOLUTION_BASE_URL=http://NOME-DO-SERVICO-EVOLUTION:8080
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE=NomeDaInstancia    # obrigatório no 01 e 06

DEBOUNCE_MS=5000                       # = API

APPOINTMENT_NOTIFY_PHONE=5511...       # alerta nova visita (workflow 01)
OPS_NOTIFY_PHONE=5511...               # opcional: só erros do sistema (06)
```

Use hostname **interno** EasyPanel (`agent-ia`, `evolution`), não o domínio público, em `AGENT_API_URL` / `EVOLUTION_BASE_URL`.

## Ordem de importação

| Passo | Arquivo | Ativar? | Função |
|-------|---------|---------|--------|
| 1 | `01-whatsapp-agent.json` | Sim | Mensagens WhatsApp → API → resposta |
| 2 | `06-ops-notifications.json` | Sim | Lembretes ao **cliente** + alertas de erro |
| 3 | `04-sync-chatwoot.json` | Se usar handoff | Modo humano via Chatwoot |

**Como importar:** n8n → Workflows → **Import from File** → escolha o JSON → abra o workflow → **Activate**.

Após atualizar o Git: **reimporte** o arquivo (ou substitua o workflow) e ative de novo.

## Webhooks (configurar fora do n8n)

| Workflow | Método | Caminho | Quem chama |
|----------|--------|---------|------------|
| 01 | POST | `/webhook/whatsapp-agent` | Evolution (mensagens recebidas) |
| 04 | POST | `/webhook/chatwoot-sync` | Chatwoot (eventos conversa) |
| 06 | — | Cron interno | n8n (a cada 30 min) |

URL completa (exemplo):

```text
https://SEU-DOMINIO-N8N/webhook/whatsapp-agent
https://SEU-DOMINIO-N8N/webhook/chatwoot-sync
```

No Evolution: webhook da instância → URL do **01** apenas.

## Teste rápido por workflow

### 01 — WhatsApp

1. Workflow ativo, Evolution com webhook apontando para o 01.
2. Envie "oi" do celular → deve haver execução no n8n e resposta no WhatsApp.
3. Se falhar: confira `AGENT_API_KEY`, `AGENT_API_URL`, logs da API.

### 06 — Lembretes

1. Workflow ativo, `EVOLUTION_INSTANCE` definido.
2. Agende visita no WhatsApp (com antecedência 20–28 h ou 1–20 h).
3. Aguarde cron ou execute manualmente o nó "Tick notificações".
4. Cliente (telefone da visita) deve receber lembrete SIM/NÃO — **não** o `OPS_NOTIFY_PHONE`.

### 04 — Chatwoot

1. Só se `FEATURE_HUMAN_HANDOFF=true` na API e função handoff ligada no portal.
2. Webhook Chatwoot → URL do 04.

## Erros comuns

| Sintoma | Correção |
|---------|----------|
| `access to env vars denied` | `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` + restart n8n |
| 06 skip: Evolution não configurado | `EVOLUTION_INSTANCE` no **serviço n8n** |
| API 401 | `AGENT_API_KEY` ≠ `API_INTERNAL_KEY` |
| Lembrete no corretor, não no cliente | Reimporte `06-ops-notifications.json` (versão recente) |
| Debounce estranho | `DEBOUNCE_MS` igual na API e n8n |

## Pacote mínimo vs completo

| Cenário | Workflows |
|---------|-----------|
| Mínimo (só WhatsApp + IA) | `01` |
| Imobiliária padrão (agentes-ia) | `01` + `06` |
| Com atendimento humano | `01` + `06` + `04` |

Definição formal: `config/product/agentes-ia.manifest.json`.
