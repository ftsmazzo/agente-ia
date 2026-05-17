# Client deployments (gitignored secrets)

Each subdirectory represents one **white-label installation** (pseudo-SaaS).

```
clients/
  _template/     ← copy when onboarding a new customer
  acme-realty/   ← example (do not commit .env)
```

## Onboarding checklist

1. Copy `_template` to `clients/<brand-slug>/`
2. Fill `env` values in EasyPanel (not in Git)
3. Run DB migrations against that Postgres
4. Import n8n workflows from `n8n/workflows/`
5. Configure Evolution ↔ Chatwoot bridge
6. Smoke test: `GET /health`, `POST /v1/chat`

See [docs/deployment-easypanel.md](../docs/deployment-easypanel.md).
