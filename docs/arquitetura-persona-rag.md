# Persona, RAG e escolha de modelo

## Sim — RAG + tabela de imóveis continua fazendo sentido

Dois cenários reais que você descreveu:

| Cenário | Exemplo | Fonte de dados | Técnica |
|---------|---------|----------------|---------|
| **A — Veio do anúncio** | Clicou no imóvel X no site, mandou "quero info AP0868" | Tabela `imoveis` por código | Lookup direto + opcional RAG na ficha |
| **B — Curioso / perfil** | "Apartamento 3 quartos no Jardim X até 500 mil" | Tabela + embeddings | SQL filtros + RAG semântico |

A API classifica a intenção em:

- `property_by_code` — tem AP####
- `property_by_criteria` — bairro, quartos, tipo, valor
- `general` — conversa inicial

O LLM **nunca inventa** imóveis: só fala de blocos `[DADOS DO SISTEMA]` (fase 2c conecta sua tabela/pgvector).

```text
Mensagem → classificar intenção → buscar imóveis (SQL/RAG) → montar prompt → LLM → WhatsApp
```

---

## Onde fica a personalidade da SofIA

| Camada | Arquivo / env | O que define |
|--------|----------------|--------------|
| **Marca** | `BRAND_*`, `ASSISTANT_NAME=SofIA` | Nome, imobiliária |
| **Persona** | `config/prompts/persona.pt-BR.md` | Tom, estilo, como conduzir conversa |
| **Regras** | `config/prompts/system.pt-BR.md` | Limites, handoff, anti-alucinação |
| **Runtime** | Código `agent-service.ts` | Intenção, dados do imóvel, histórico |

Env:

```env
PERSONA_PROMPT_PATH=/app/config/prompts/persona.pt-BR.md
SYSTEM_PROMPT_PATH=/app/config/prompts/system.pt-BR.md
```

Por cliente white-label: monte volume só com `persona.pt-BR.md` customizado.

**Frontend de config (futuro):** editar persona + escolher modelo + feature flags — mesmo conteúdo que hoje está no env/arquivos.

---

## Escolher OpenAI ou Claude (agora: env)

```env
# openai | anthropic  (anthropic aceita alias "claude")
LLM_PROVIDER=anthropic

# Chaves (só a do provedor ativo é obrigatória)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Modelos (teste um de cada vez)
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_MODEL=claude-3-5-haiku-20241022

# Opcional: força modelo independente do provedor
# LLM_MODEL=claude-sonnet-4-20250514

LLM_MAX_TOKENS=600
CHAT_MAX_HISTORY_TURNS=8
```

Troque `LLM_PROVIDER` + redeploy → teste A/B no mesmo WhatsApp.

`/health` retorna `llm.provider` e `llm.model` ativos (sem expor keys).

### Sugestão de testes

| Provedor | Modelo | Uso |
|----------|--------|-----|
| openai | `gpt-4o-mini` | Rápido/barato, bom WhatsApp |
| openai | `gpt-4o` | Melhor raciocínio |
| anthropic | `claude-3-5-haiku-20241022` | Rápido |
| anthropic | `claude-sonnet-4-20250514` | Persona mais rica |

---

## Roadmap técnico (encaixado)

| Fase | Entrega |
|------|---------|
| **2a** ✅ | Persona em arquivo, multi-LLM, intenção A/B |
| **2c** ✅ | RAG externo (`property-rag-service`) → `[DADOS DO SISTEMA]` — ver [rag-integracao.md](./rag-integracao.md) |
| **2c-b** | Lookup SQL por código AP#### no Postgres |
| **2d** | MCP ou API do workflow Imóveis Pazotti (se migrar catálogo) |
| **3** | Admin UI (persona, modelo, flags) |
| **4** | Debounce n8n, áudio, Chatwoot |

---

## Resumo

- **Persona:** `persona.pt-BR.md` + `ASSISTANT_NAME` — não hardcoded no código.
- **Sem código AP:** busca por critérios (RAG + tabela) — arquitetura correta.
- **Com código AP:** lookup direto — arquitetura correta.
- **Claude/OpenAI:** `LLM_PROVIDER` no env para testar agora; UI depois.
