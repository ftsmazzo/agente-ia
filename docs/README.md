# Documentação — Realty Agent Platform

Índice da documentação versionada com o código.

| Documento | Conteúdo |
|-----------|----------|
| [architecture.md](./architecture.md) | Visão da arquitetura, camadas e fluxo de mensagens |
| [white-label.md](./white-label.md) | Estratégia white-label, BrandConfig, o que nunca commitar |
| [environment-variables.md](./environment-variables.md) | Referência completa de variáveis |
| [local-development.md](./local-development.md) | Rodar Postgres, Redis e API na máquina local |
| [deployment-easypanel.md](./deployment-easypanel.md) | Deploy Docker, EasyPanel, novo cliente |
| [easypanel-deploy.md](./easypanel-deploy.md) | **Primeiro deploy** do repo agente-ia |
| [n8n-integracao.md](./n8n-integracao.md) | Workflow Evolution → API → WhatsApp |
| [fase-2-llm.md](./fase-2-llm.md) | Motor OpenAI + histórico |
| [debounce.md](./debounce.md) | Debounce WhatsApp (burst de mensagens) |
| [operations-production.md](./operations-production.md) | Checklist produção EasyPanel |
| [handoff-chatwoot.md](./handoff-chatwoot.md) | Handoff humano + API Chatwoot |
| [chatwoot-evolution-setup.md](./chatwoot-evolution-setup.md) | Conectar Chatwoot na Evolution (teste) |
| [agenda.md](./agenda.md) | Agenda própria no Postgres + notificação |
| [arquitetura-persona-rag.md](./arquitetura-persona-rag.md) | Persona, RAG, OpenAI vs Claude |
| [rag-integracao.md](./rag-integracao.md) | RAG imóveis — env, indexação, validação |
| [dados-gravados.md](./dados-gravados.md) | O que vai para o Postgres |
| [api-contract.md](./api-contract.md) | Contrato HTTP entre n8n e a API |
| [versioning.md](./versioning.md) | Versionamento, changelog e releases |

## Convenções

- Código e schema: **nomes genéricos** (`app.contacts`, `realty-agent-api`).
- Marca do cliente: **somente** variáveis de ambiente por instalação.
- Documentação técnica em português; identificadores de código em inglês.
