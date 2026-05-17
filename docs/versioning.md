# Versionamento

## Semântica

Seguimos [Semantic Versioning](https://semver.org/):

- **MAJOR** — breaking change na API ou schema obrigatório.
- **MINOR** — features compatíveis (novo endpoint, campo opcional).
- **PATCH** — correções e docs.

Versão atual do monorepo: `0.1.0` (fundação — API stub).

## Changelog

Registrar mudanças em `CHANGELOG.md` no formato [Keep a Changelog](https://keepachangelog.com/).

Categorias: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.

## Git

- `main` — estável, deployável.
- `develop` — integração (opcional).
- Tags `v0.1.0` para releases Docker.

## Migrations SQL

- Arquivos numerados: `001_*.sql`, `002_*.sql`.
- Nunca editar migration já aplicada em produção — criar nova.
- Tabela de controle: `app.schema_migrations`.

## Imagens Docker

Tag recomendada: `ghcr.io/<org>/realty-agent-api:0.1.0`

Evitar `latest` em produção de clientes.

## Documentação

Docs em `docs/` versionam junto com o código.

Ao mudar contrato da API, atualizar `api-contract.md` no mesmo PR.
