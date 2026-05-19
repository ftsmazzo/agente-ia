# Produto — Portal do cliente

Uma instalação EasyPanel = uma empresa. O **portal** (`painel.<dominio>`) é o serviço Docker `apps/portal`; a **API** no subdomínio do agente.

## Usuários — só variáveis de ambiente (sem curl)

No serviço **agente-ia**, defina na implantação:

```env
PORTAL_JWT_SECRET=<string longa aleatória>
PORTAL_CORS_ORIGIN=https://painel.seudominio.com

# Você (implantador) — acesso total
PORTAL_ADMIN_EMAIL=voce@empresa.com
PORTAL_ADMIN_PASSWORD=senha-forte-min-8
PORTAL_ADMIN_NAME=Seu Nome

# Cliente (opcional) — agenda e agente no dia a dia
PORTAL_CLIENT_EMAIL=gerente@cliente.com
PORTAL_CLIENT_PASSWORD=outra-senha-forte
PORTAL_CLIENT_NAME=Gerente Cliente
```

No **startup do container**, após as migrations, o script `seed-portal-users.mjs`:

1. **Cria** o usuário se o e-mail ainda não existir.
2. **Não recria** nem altera senha a cada restart (seguro para produção).
3. Para **trocar senha via env** (redeploy): `PORTAL_SYNC_PASSWORD_FROM_ENV=true` uma vez, depois volte para `false`.

Desligar seed: `PORTAL_SEED_ON_START=false`.

Logs esperados: `[portal-seed] usuário criado: ...` ou `usuário já existe (sem alteração)`.

## Papéis

| Papel | Env | Portal |
|-------|-----|--------|
| `installer` | `PORTAL_ADMIN_*` | Tudo + criar usuários extras em Equipe |
| `client` | `PORTAL_CLIENT_*` | Agenda, agente, dashboard |

Secrets (Postgres, LLM, Evolution) ficam só no EasyPanel — não no portal.

## Deploy EasyPanel

| Serviço | Dockerfile | Domínio |
|---------|------------|---------|
| agente-ia | `/Dockerfile` | API |
| portal | `/apps/portal/Dockerfile` | `painel.<cliente>` |

| Onde | Variável | Valor |
|------|----------|--------|
| Serviço **portal** | `PORTAL_API_URL` | URL da API (Environment, runtime) |
| Serviço **agente-ia** | `PORTAL_CORS_ORIGIN` | URL exata do painel (`https://painel...`) |

Se aparecer **Failed to fetch** ou **Mixed Content**: a API no env deve ser `https://...` (não `http://`). Confira também `PORTAL_CORS_ORIGIN` na API = URL exata do painel.

Erros `runtime.lastError` / `extension port` no console vêm de extensões do Chrome — ignore; não são do portal.

## Camadas do prompt

Ver arquitetura em [arquitetura-persona-rag.md](./arquitetura-persona-rag.md). O portal edita `app.agent_config` (empresa, tom, objetivos, regras).

## Telas do portal

| Rota | Função |
|------|--------|
| `/` | Resumo |
| `/agenda` | Horários, visitas, bloqueios |
| `/catalogo` | CSV: analisar colunas, importar (substituir ou mesclar), exportar |
| `/agente` | Tom, empresa, objetivos |
| `/conversas` | Histórico de conversas WhatsApp |
| `/monitor` | Falhas de processamento |
| `/equipe` | Criar login cliente (implantador) |

## Roadmap UI

- v0.13 ✅ Catálogo + monitor + agenda completa
- v0.14 ✅ Catálogo CSV genérico + mesclar/exportar
- v0.15 ✅ Histórico de conversas no painel
