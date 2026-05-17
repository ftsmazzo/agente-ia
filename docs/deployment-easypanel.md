# Deploy no EasyPanel

## Visão

Cada cliente = **projeto/stack** no EasyPanel com serviços:

| Serviço | Tipo | Notas |
|---------|------|-------|
| PostgreSQL | App template | Um DB por cliente |
| Redis | App template | |
| Evolution API | Docker | Bridge Chatwoot |
| Chatwoot | Docker | UI corretores |
| n8n | Docker | Workflows importados |
| **realty-api** | App from Dockerfile | Este repositório |

## Build da API

1. Criar repositório GitHub `realty-agent-platform`.
2. Conectar EasyPanel ao GitHub ou usar registry.
3. Dockerfile: `apps/api/Dockerfile` (contexto = raiz do repo).
4. Variáveis: copiar de `deploy/clients/_template/env.example` + `.env.example`.

## Variáveis críticas no EasyPanel

- Todas as `BRAND_*` do cliente.
- `DATABASE_URL`, `REDIS_URL` apontando para serviços internos.
- `API_INTERNAL_KEY` — string aleatória longa.
- Keys de IA e integrações.

Montar volume ou baked-in: `config/prompts` (já na imagem).

## Rede

Todos os apps na **mesma rede Docker** do EasyPanel.

n8n chama a API por hostname do serviço, ex.: `http://realty-api:3000`.

## Migrations

Executar uma vez por deploy:

```bash
# De uma máquina com acesso ao Postgres do cliente
DATABASE_URL=postgresql://... npm run db:migrate
```

Ou job one-off no EasyPanel com imagem Node.

## GitHub Actions (opcional)

`.github/workflows/ci.yml` valida PRs.

Para publicar imagem em `ghcr.io`, adicione workflow de push (fase seguinte).

## Checklist go-live

- [ ] `GET /health` retorna `brand_slug` correto
- [ ] `check:brand-leaks` passa no CI
- [ ] Migrations aplicadas
- [ ] n8n workflows importados
- [ ] Evolution webhook → n8n
- [ ] Chatwoot ↔ Evolution ativo
- [ ] `POST /v1/chat` responde com `X-API-Key`
- [ ] Mensagem teste WhatsApp ponta a ponta

## Novo cliente (resumo)

1. Duplicar stack EasyPanel (ou novo projeto).
2. Novo `BRAND_*` + secrets.
3. Nova instância Evolution + conta Chatwoot.
4. Migrar DB vazio.
5. Sem alterar código — só configuração.
