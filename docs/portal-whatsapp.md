# WhatsApp no portal

Tela **WhatsApp** (`/whatsapp`) — uma instância Evolution por deploy.

## O que faz

- Mostra **status** (conectado / conectando / desconectado)
- **Número** e nome do perfil WhatsApp
- **Reconectar** — gera QR (ou código de pareamento) via Evolution
- **Desconectar** — só implantador (`installer`)
- Exibe URL do **webhook n8n** (referência; o cadastro real continua no painel Evolution)

## Env no serviço **agente-ia**

```env
EVOLUTION_BASE_URL=http://evolution:8080
EVOLUTION_API_KEY=sua-apikey-da-instancia
EVOLUTION_INSTANCE=nome-da-instancia

# Opcional — só para mostrar no painel
N8N_WHATSAPP_WEBHOOK_URL=https://n8n.seudominio.com/webhook/whatsapp-agent
```

Use a URL **interna** da Evolution na rede Docker (`http://nome-do-servico:8080`), não o domínio público, se a API estiver no mesmo stack.

## Webhooks

O fluxo de mensagens **não passa pelo portal**. Continua:

1. Evolution recebe WhatsApp
2. Webhook POST → n8n (`whatsapp-agent`)
3. n8n → API `/v1/chat`

Configure o webhook no **painel da instância Evolution** (igual hoje). O portal só ajuda a **vincular/desvincular** a sessão WhatsApp.

## API (portal autenticado)

| Método | Rota |
|--------|------|
| GET | `/v1/portal/whatsapp/status` |
| POST | `/v1/portal/whatsapp/connect` |
| POST | `/v1/portal/whatsapp/disconnect` (installer) |
