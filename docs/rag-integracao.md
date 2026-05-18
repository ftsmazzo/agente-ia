# Integração RAG — imóveis (Fase 2c)

API do agente consulta o [RAG Knowledge Base](https://rag.fabricadosdados.ia.br/api-docs) antes do LLM e injeta o bloco `[DADOS DO SISTEMA]`.

**Não é obrigatório** ter tabela Postgres de imóveis: com chunks `Referência: AP####` (1 linha = 1 chunk), a API parseia bairro, valor, dormitórios e monta a ficha para a SofIA. Postgres serve para CRM/leads; catálogo pode ficar só no RAG.

## Fluxo

```text
Mensagem → intenção (código AP#### ou perfil) → POST /api/kb/{id}/query → LLM → WhatsApp
```

| Intenção | Consulta RAG? |
|----------|----------------|
| `property_by_code` | Sim |
| `property_by_criteria` | Sim |
| `general` | Não (só conversa) |

Se o RAG falhar, a API **continua** com o LLM (sem bloco de imóveis) e registra `rag.error` nos metadados do evento.

## Variáveis (EasyPanel — serviço API)

```env
FEATURE_PROPERTY_RAG=true

RAG_API_URL=https://rag.fabricadosdados.ia.br
RAG_API_KEY=sua_chave
RAG_KNOWLEDGE_BASE_ID=30001

# Opcionais
RAG_TOP_K=3
RAG_TIMEOUT_MS=45000
```

Gere a chave em [API Keys](https://rag.fabricadosdados.ia.br/api-keys).

Liste a base com:

```bash
curl -s "https://rag.fabricadosdados.ia.br/api/knowledge-bases" \
  -H "Authorization: Bearer SUA_API_KEY"
```

## Como o RAG funciona (e por que “sumiu” o bairro)

1. A planilha vira **chunks** grandes (vários imóveis por trecho, ~500 tokens).
2. A API manda uma **pergunta em texto** (`bairro Planalto Verde 2 quartos Ribeirão Preto venda`).
3. O RAG devolve os **top K trechos** mais parecidos semanticamente — não é SQL.
4. A API **parseia** linhas `Ativo,AP####,...` e filtra pelo bairro/quartos no texto.

Se o bairro está no chunk 78 mas `topK=3` só traz chunks 14, 27 e 52, a SofIA não vê Planalto Verde. Por isso usamos `RAG_TOP_K_CRITERIA=10` e query com **histórico** (“E no Planalto Verde?”).

**Melhor indexação (recomendado):** 1 documento por imóvel, começando com:

```text
Código: AP0767
Bairro: Planalto Verde
Cidade: Ribeirão Preto
Quartos: 2 | Banheiros: 1
Tipo: Apartamento | Operação: Venda
```

## Indexar imóveis na base

No painel do RAG, suba documentos por imóvel (texto, PDF ou export do site). Ideal em cada documento:

- Código **AP####** no título ou corpo
- Bairro, quartos, valor, tipo
- **Somente venda** (a API filtra menções a aluguel no snippet)
- Link público se existir (`BRAND_WEBSITE` + `/imovel/AP####`)

## Validar deploy

1. `/health` → `rag.enabled: true` e `knowledgeBaseId` preenchido
2. WhatsApp: *"Apartamento 3 quartos nos Jardins"*
3. n8n → nó API → `reason`: `llm_openai_rag` (ou `llm_anthropic_rag`)
4. Metadados do evento: `rag.sourceCount` > 0

## Próximo passo

Lookup por código **AP####** no Postgres (complementa o RAG quando o cliente manda o código exato).
