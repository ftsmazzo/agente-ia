# Implantação de nova empresa (do zero)

Um deploy EasyPanel = **uma empresa**. Use este roteiro na ordem.

## 1. Infraestrutura

| Serviço | Obrigatório | Função |
|---------|-------------|--------|
| Postgres | Sim | Banco `realty` |
| Redis | Sim | Histórico e debounce |
| agente-ia (API) | Sim | Agente + portal backend |
| portal | Sim | Painel web |
| Evolution | Sim | WhatsApp |
| n8n | Sim | Webhook e envio de mensagens |
| Chatwoot | Não | Só se quiser atendimento humano no inbox |

Todos na **mesma rede Docker** do EasyPanel.

## 2. Variáveis por serviço

Copie de [`env-templates/`](../env-templates/) para o Environment de cada serviço:

1. [`01-agente-ia.env`](../env-templates/01-agente-ia.env) — API + portal seed
2. [`02-n8n.env`](../env-templates/02-n8n.env)
3. [`05-postgres.env`](../env-templates/05-postgres.env) / [`06-redis.env`](../env-templates/06-redis.env)
4. Evolution: painel da instância + `EVOLUTION_*` na API

Mapa completo: [variaveis-por-servico.md](./variaveis-por-servico.md)

### Produção (API)

```env
NODE_ENV=production
RESET_DEV_DATA_ON_START=false
RUN_MIGRATIONS_ON_START=true
PORTAL_CORS_ORIGIN=https://painel.SEUDOMINIO.com
PORTAL_API_URL no serviço portal = https://api.SEUDOMINIO.com
```

## 3. Ordem de deploy

1. Postgres + Redis
2. **agente-ia** (migrations automáticas no startup)
3. **portal** (`PORTAL_API_URL` HTTPS)
4. **Evolution** — criar instância, conectar QR
5. **n8n** — importar `n8n/workflows/01-whatsapp-agent.json`
6. Evolution → webhook = URL do n8n (`/webhook/whatsapp-agent`)

## 4. Validar no portal

Login implantador (`PORTAL_ADMIN_*`):

| Tela | Validar |
|------|---------|
| **Sistema** | Postgres, Redis, WhatsApp conectado, sem RESET_DEV |
| **WhatsApp** | Número aparece, status Conectado |
| **Catálogo** | Importar CSV do nicho |
| **Agente** | Perfil da empresa e tom |
| **Agenda** | Horários e local |
| Início | Banner verde ou sem alertas críticos |

## 5. Teste ponta a ponta

1. Mensagem no WhatsApp → n8n → API → resposta
2. Portal **Conversas** — histórico com texto
3. Portal **Contatos** — lead gravado
4. `GET /health` na API — `status: ok`

## 6. Entregar ao cliente

Crie login cliente (`PORTAL_CLIENT_*` ou **Equipe** no portal):

- Agenda, catálogo, agente, contatos, conversas
- **Não** precisa de acesso a Sistema / Equipe (implantador)

## Referências

- [produto-portal.md](./produto-portal.md)
- [portal-whatsapp.md](./portal-whatsapp.md)
- [catalogo-csv.md](./catalogo-csv.md)
- [operations-production.md](./operations-production.md)
