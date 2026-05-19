import type pg from "pg";
import { checkDatabase } from "../db/pool.js";
import { checkRedis } from "../redis/client.js";
import type { AppConfig } from "../config/app-config.js";
import {
  getWhatsAppStatus,
  type WhatsAppConnectionStatus,
  type WhatsAppStatus,
} from "./evolution-service.js";

export type ChecklistStatus = "ok" | "warn" | "error";

export type ChecklistItem = {
  id: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
};

export type SystemOverview = {
  version: string;
  overall: ChecklistStatus;
  checks: { database: boolean; redis: boolean };
  whatsapp: WhatsAppStatus;
  llm: { enabled: boolean; provider: string; model: string };
  rag: { enabled: boolean };
  catalogActive: number;
  failedMessages: number;
  checklist: ChecklistItem[];
};

function worstStatus(items: ChecklistItem[]): ChecklistStatus {
  if (items.some((i) => i.status === "error")) return "error";
  if (items.some((i) => i.status === "warn")) return "warn";
  return "ok";
}

export type DashboardHealthSummary = {
  overall: ChecklistStatus;
  version: string;
  whatsapp: {
    status: WhatsAppConnectionStatus;
    phone: string | null;
  };
  alerts: string[];
};

export async function getDashboardHealthSummary(
  config: AppConfig,
  counts: { catalogActive: number; failedMessages: number },
): Promise<DashboardHealthSummary> {
  const alerts: string[] = [];
  let overall: ChecklistStatus = "ok";

  const bump = (level: ChecklistStatus) => {
    if (level === "error") overall = "error";
    else if (level === "warn" && overall !== "error") overall = "warn";
  };

  if (process.env.RESET_DEV_DATA_ON_START === "true") {
    alerts.push("RESET_DEV_DATA_ON_START ativo — desligue em produção");
    bump("error");
  }

  if (counts.failedMessages > 0) {
    alerts.push(
      `${counts.failedMessages} falha(s) pendente(s) — veja Monitor`,
    );
    bump("warn");
  }

  if (counts.catalogActive === 0) {
    alerts.push("Catálogo vazio — importe CSV se o agente usar itens");
    bump("warn");
  }

  if (!config.llm.enabled) {
    alerts.push("LLM sem chave configurada");
    bump("warn");
  }

  const whatsapp = await getWhatsAppStatus(config.evolution);
  if (!whatsapp.configured) {
    alerts.push("Evolution não configurada (EVOLUTION_* na API)");
    bump("warn");
  } else if (whatsapp.status !== "connected") {
    alerts.push("WhatsApp desconectado");
    bump("warn");
  }

  return {
    overall,
    version: process.env.APP_VERSION ?? "0.0.0",
    whatsapp: { status: whatsapp.status, phone: whatsapp.phone },
    alerts,
  };
}

export async function getSystemOverview(
  config: AppConfig,
  pool: pg.Pool,
): Promise<SystemOverview> {
  const checklist: ChecklistItem[] = [];

  let dbOk = false;
  let redisOk = false;
  let catalogActive = 0;
  let failedMessages = 0;

  try {
    dbOk = await checkDatabase(config.databaseUrl);
    checklist.push({
      id: "database",
      label: "PostgreSQL",
      status: dbOk ? "ok" : "error",
      detail: dbOk ? "Conectado" : "Falha na conexão — confira DATABASE_URL",
    });
  } catch {
    checklist.push({
      id: "database",
      label: "PostgreSQL",
      status: "error",
      detail: "Falha na conexão — confira DATABASE_URL",
    });
  }

  try {
    redisOk = await checkRedis(config.redisUrl);
    checklist.push({
      id: "redis",
      label: "Redis",
      status: redisOk ? "ok" : "error",
      detail: redisOk ? "Conectado" : "Falha na conexão — confira REDIS_URL",
    });
  } catch {
    checklist.push({
      id: "redis",
      label: "Redis",
      status: "error",
      detail: "Falha na conexão — confira REDIS_URL",
    });
  }

  if (dbOk) {
    try {
      const failed = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM app.failed_messages WHERE resolved_at IS NULL`,
      );
      failedMessages = Number(failed.rows[0]?.count ?? 0);
      checklist.push({
        id: "failed_messages",
        label: "Fila de falhas",
        status: failedMessages > 0 ? "warn" : "ok",
        detail:
          failedMessages > 0
            ? `${failedMessages} mensagem(ns) sem resolver — veja Monitor`
            : "Nenhuma falha pendente",
      });

      const props = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM app.catalog_items WHERE active = TRUE`,
      );
      catalogActive = Number(props.rows[0]?.count ?? 0);
      checklist.push({
        id: "catalog",
        label: "Catálogo",
        status: catalogActive > 0 ? "ok" : "warn",
        detail:
          catalogActive > 0
            ? `${catalogActive} item(ns) ativo(s)`
            : "Vazio — importe CSV em Catálogo ou use só RAG",
      });
    } catch {
      /* parcial ok */
    }
  }

  if (process.env.RESET_DEV_DATA_ON_START === "true") {
    checklist.push({
      id: "reset_dev",
      label: "Modo desenvolvimento",
      status: "error",
      detail:
        "RESET_DEV_DATA_ON_START=true apaga dados a cada restart — defina false em produção",
    });
  }

  if (config.nodeEnv === "production") {
    const cors = config.portal.corsOrigins;
    checklist.push({
      id: "portal_cors",
      label: "Portal (CORS)",
      status: cors === false ? "error" : "ok",
      detail:
        cors === false
          ? "PORTAL_CORS_ORIGIN ausente — painel não chama a API"
          : "Origem do painel configurada",
    });
  }

  checklist.push({
    id: "llm",
    label: "Modelo de IA",
    status: config.llm.enabled ? "ok" : "warn",
    detail: config.llm.enabled
      ? `${config.llm.provider} / ${config.llm.model}`
      : "Sem chave LLM — respostas limitadas ao fallback",
  });

  const whatsapp = await getWhatsAppStatus(config.evolution);
  checklist.push({
    id: "whatsapp",
    label: "WhatsApp (Evolution)",
    status:
      !whatsapp.configured
        ? "warn"
        : whatsapp.status === "connected"
          ? "ok"
          : whatsapp.status === "connecting"
            ? "warn"
            : whatsapp.error
              ? "error"
              : "warn",
    detail: !whatsapp.configured
      ? "Defina EVOLUTION_* no serviço agente-ia"
      : whatsapp.status === "connected"
        ? whatsapp.phone
          ? `Conectado · ${whatsapp.phone}`
          : "Conectado"
        : whatsapp.error ??
          (whatsapp.stateRaw
            ? `Estado: ${whatsapp.stateRaw}`
            : "Desconectado — reconecte em WhatsApp"),
  });

  if (whatsapp.webhookUrl) {
    checklist.push({
      id: "webhook",
      label: "Webhook n8n",
      status: "ok",
      detail: whatsapp.webhookUrl,
    });
  }

  return {
    version: process.env.APP_VERSION ?? "0.0.0",
    overall: worstStatus(checklist),
    checks: { database: dbOk, redis: redisOk },
    whatsapp,
    llm: {
      enabled: config.llm.enabled,
      provider: config.llm.provider,
      model: config.llm.model,
    },
    rag: { enabled: config.rag.enabled },
    catalogActive,
    failedMessages,
    checklist,
  };
}
