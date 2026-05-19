#!/usr/bin/env node
/**
 * Imprime checklist de instalação a partir do manifesto agentes-ia.
 * Uso: node scripts/print-install-checklist.mjs [nome-empresa]
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const company = process.argv[2]?.trim() || "NOVA_EMPRESA";

const manifest = JSON.parse(
  await readFile(join(root, "config/product/agentes-ia.manifest.json"), "utf8"),
);

console.log(`\n=== Pacote ${manifest.id}: ${manifest.name} ===`);
console.log(`Empresa: ${company}\n`);

console.log("--- Serviços EasyPanel (ordem) ---");
console.log("1. PostgreSQL + Redis");
console.log("2. agente-ia (API)     → env-templates/01-agente-ia.env");
console.log("3. painel-ia (portal)  → PORTAL_API_URL / VITE_API_URL");
console.log("4. Evolution");
console.log("5. n8n                 → env-templates/02-n8n.env");
console.log("6. (opcional) Chatwoot\n");

console.log("--- Chave única ---");
console.log("Gere API_INTERNAL_KEY e use o MESMO valor como AGENT_API_KEY no n8n\n");

console.log("--- Workflows n8n (import + ativar) ---");
for (const cap of manifest.capabilities) {
  if (!cap.workflows?.length) continue;
  console.log(`\n[${cap.id}] ${cap.label}`);
  for (const w of cap.workflows) {
    console.log(`  - n8n/workflows/${w}`);
  }
  if (cap.env?.api?.length) {
    console.log(`  API env: ${cap.env.api.join(", ")}`);
  }
  if (cap.env?.n8n?.length) {
    console.log(`  n8n env: ${cap.env.n8n.join(", ")}`);
  }
}

console.log("\n--- Webhooks Evolution ---");
console.log("POST https://SEU-N8N/webhook/whatsapp-agent\n");

console.log("--- Portal (após deploy) ---");
console.log("- Login admin");
console.log("- Personalizar agente → funções:", manifest.defaultCapabilities.join(", "));
console.log("- Agenda + Catálogo");
console.log("- WhatsApp → conectar QR\n");

console.log("--- Testes ---");
console.log("- docs/instalacao-nova-empresa.md (Fase 6)\n");

console.log("Doc completa: docs/instalacao-nova-empresa.md");
console.log("n8n: n8n/workflows/INSTALL.md\n");
