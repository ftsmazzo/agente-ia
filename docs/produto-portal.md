# Produto — Portal do cliente

Uma instalação EasyPanel = uma empresa. O **portal** (`painel.<dominio>`) é o serviço Docker `apps/portal`; a **API** continua em `api.<dominio>` ou subdomínio do agente.

## Papéis

| Papel | Quem | Pode |
|-------|------|------|
| `installer` | Você (implantador) | Tudo + criar usuários `client` |
| `client` | Dono/gerente do cliente | Agenda, personalizar agente, ver resumo |

Secrets (Postgres, LLM, Evolution, n8n) permanecem só no EasyPanel — não entram no portal.

## Camadas do prompt

| Camada | Onde | Editável no portal |
|--------|------|-------------------|
| 0 — Regras da plataforma | Código | Não |
| 1 — Base + vertical pack | `config/prompts/` | Não |
| 2 — Empresa, tom, objetivos, lapidação | `app.agent_config` | Sim (`client`) |
| 3 — Catálogo + RAG + agenda | Postgres / env | Agenda sim; catálogo v1 só leitura |

## Primeiro acesso

1. Defina `PORTAL_JWT_SECRET` e `PORTAL_BOOTSTRAP_SECRET` na API.
2. `POST /v1/portal/auth/bootstrap` com `{ "secret", "email", "password", "name" }` — cria o primeiro usuário `installer` (só se não existir usuário).
3. No portal, login com e-mail e senha.
4. Crie usuários `client` em **Equipe** (somente `installer`).

## Deploy EasyPanel

| Serviço | Dockerfile | Domínio sugerido |
|---------|------------|------------------|
| agente-ia (API) | `/Dockerfile` | `assets-agent-ia...` |
| portal | `/apps/portal/Dockerfile` | `painel.<cliente>` |

Variáveis do portal: `VITE_API_URL=https://...` (build arg ou env no build).

API: `PORTAL_CORS_ORIGIN=https://painel.seudominio.com`

## Roadmap UI

- v0.12 ✅ Login, dashboard, agenda, personalizar agente
- v0.13 Catálogo (upload planilha), blackouts na UI
- v0.14 Monitor de conversas / falhas
