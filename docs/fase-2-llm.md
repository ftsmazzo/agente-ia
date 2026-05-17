# Fase 2 — Motor LLM (SofIA)

## O que mudou

A API passa a responder com **OpenAI** usando:

- System prompt white-label (`config/prompts/system.pt-BR.md`)
- Contexto dinâmico (nome do cliente, código AP####)
- **Histórico** das últimas mensagens no Redis (8 turnos padrão)

Se `OPENAI_API_KEY` não estiver definida, mantém o ack da Fase 1.

## Variáveis (app API — EasyPanel)

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
CHAT_MAX_HISTORY_TURNS=8
```

## Deploy

1. Adicione `OPENAI_API_KEY` nas **Environment Variables** da API
2. Redeploy do serviço `agent-ia`
3. Não precisa alterar o workflow n8n

## Comportamento esperado

- Conversa natural, curta, em português
- Usa o nome se `pushName` foi gravado
- Com código AP1234: qualifica sem inventar ficha do imóvel
- Histórico: segunda mensagem mantém contexto da primeira

## Próxima fase (2b)

- RAG / MCP Imóveis (dados reais de anúncios)
- Debounce no n8n
- Áudio
