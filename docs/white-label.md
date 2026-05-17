# White-label

## Modelo comercial

- **Um repositório** neutro no GitHub.
- **Uma instalação** EasyPanel por imobiliária (Postgres, Redis, Evolution, Chatwoot, n8n, API).
- Identidade trocada por **variáveis de ambiente**, sem fork de código.

Isso permite vender implementações repetíveis sem engine multi-tenant na v1.

## O que vai no código vs no deploy

| No Git (genérico) | Por cliente (EasyPanel / `deploy/clients/`) |
|-------------------|---------------------------------------------|
| `BRAND_NAME` como variável | `BRAND_NAME=Imobiliária X` |
| Template `{{brand_name}}` em prompts | Prompt customizado opcional no volume |
| Schema `app.contacts` | Dados do cliente |
| Imagem Docker `realty-agent-api` | Mesma imagem, env diferente |

## BrandConfig

Carregado em runtime a partir do ambiente (`packages/shared`):

- `BRAND_NAME`, `BRAND_SLUG`
- `ASSISTANT_NAME`, `ASSISTANT_TITLE`
- `BRAND_WEBSITE`, `BRAND_PRIMARY_COLOR`, `BRAND_LOGO_URL`
- `DEFAULT_LOCALE`, `TIMEZONE`

Validação com **Zod** — a API não sobe se faltar variável obrigatória.

## Templates de prompt

Arquivo padrão: `config/prompts/system.pt-BR.md`

Placeholders suportados:

- `{{brand_name}}`
- `{{brand_slug}}`
- `{{assistant_name}}`
- `{{assistant_title}}`
- `{{brand_website}}`

Montagem em `apps/api/src/lib/prompt-loader.ts`.

## Proteção no CI

```bash
npm run check:brand-leaks
```

Lê termos proibidos de `scripts/banned-brands.txt` e falha o build se aparecerem em `apps/`, `packages/`, `config/prompts/`, `db/`.

**Adicione** nomes de clientes reais à lista banida; **nunca** os coloque no código-fonte.

## Onboarding de novo cliente

1. Copiar `deploy/clients/_template/` → `deploy/clients/<slug>/` (local, gitignored).
2. Criar stack no EasyPanel com env preenchido.
3. `npm run db:migrate` no Postgres desse cliente.
4. Importar workflows n8n.
5. Configurar Evolution + Chatwoot.
6. Testar `/health` e `/v1/chat`.

## Anti-padrões

- Nome de imobiliária em strings no TypeScript/SQL.
- Tabelas `cliente_x_contatos` — use schema `app` fixo.
- Webhook `/webhook/pazotti` no código — use env `BRAND_SLUG` no n8n.
- Dois caminhos de gravação de lead (canvas + MCP write).
