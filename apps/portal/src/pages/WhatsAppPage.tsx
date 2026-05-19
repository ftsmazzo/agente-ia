import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api, type PortalUser, type WhatsAppStatus } from "../api.js";

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) {
    return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  return phone;
}

function statusLabel(status: WhatsAppStatus["status"]): string {
  if (status === "connected") return "Conectado";
  if (status === "connecting") return "Conectando…";
  if (status === "disconnected") return "Desconectado";
  return "Indefinido";
}

function statusClass(status: WhatsAppStatus["status"]): string {
  if (status === "connected") return "wa-status wa-status-ok";
  if (status === "connecting") return "wa-status wa-status-pending";
  return "wa-status wa-status-off";
}

export function WhatsAppPage() {
  const { user } = useOutletContext<{ user: PortalUser | null }>();
  const [wa, setWa] = useState<WhatsAppStatus | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { whatsapp } = await api.getWhatsAppStatus();
    setWa(whatsapp);
    return whatsapp;
  }, []);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, [refresh]);

  useEffect(() => {
    if (wa?.status !== "connecting") return undefined;
    const id = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(id);
  }, [wa?.status, refresh]);

  async function onReconnect() {
    setBusy(true);
    setError("");
    setMessage("");
    setQr(null);
    setPairingCode(null);
    setHint(null);
    try {
      const result = await api.connectWhatsApp();
      setQr(result.qrCodeDataUrl);
      setPairingCode(result.pairingCode);
      setHint(result.message);
      setMessage("Escaneie o QR no celular ou use o código de pareamento.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao reconectar");
    } finally {
      setBusy(false);
    }
  }

  async function onDisconnect() {
    if (
      !window.confirm(
        "Desconectar o WhatsApp desta instalação? O bot para de enviar e receber até reconectar.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    setQr(null);
    try {
      const { whatsapp } = await api.disconnectWhatsApp();
      setWa(whatsapp);
      setMessage("Sessão encerrada na Evolution.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao desconectar");
    } finally {
      setBusy(false);
    }
  }

  async function onRefresh() {
    setBusy(true);
    setError("");
    try {
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 style={{ marginTop: 0 }}>WhatsApp</h1>
      <p style={{ color: "var(--muted)" }}>
        Uma instância por instalação (Evolution API). Webhooks continuam no
        painel da Evolution → n8n; aqui você vê o status e reconecta sem abrir
        outro sistema.
      </p>

      {message && <p style={{ color: "#6bcf8e" }}>{message}</p>}
      {error && <p className="error">{error}</p>}

      {!wa ? (
        <p style={{ color: "var(--muted)" }}>Carregando…</p>
      ) : (
        <div className="wa-card">
          <div className="wa-card-header">
            <div className="wa-identity">
              {wa.profilePictureUrl ? (
                <img
                  src={wa.profilePictureUrl}
                  alt=""
                  className="wa-avatar"
                />
              ) : (
                <div className="wa-avatar wa-avatar-placeholder">WA</div>
              )}
              <div>
                <strong className="wa-instance">
                  {wa.instanceName ?? "—"}
                </strong>
                <p className="item-meta" style={{ margin: 0 }}>
                  {wa.profileName ?? "Conta WhatsApp"}
                </p>
              </div>
            </div>
            <span className={statusClass(wa.status)}>
              {statusLabel(wa.status)}
            </span>
          </div>

          {wa.error && (
            <p className="error" style={{ margin: "0 0 1rem" }}>
              {wa.error}
            </p>
          )}
          {wa.stateRaw && wa.status === "unknown" && (
            <p className="item-meta" style={{ margin: "0 0 1rem" }}>
              Estado retornado pela Evolution: <code>{wa.stateRaw}</code>
            </p>
          )}

          <div className="wa-phone-box">
            <span className="wa-phone-label">Número na conta</span>
            <span className="wa-phone-value">
              {wa.phone ? formatPhone(wa.phone) : "—"}
            </span>
          </div>

          {wa.integration && (
            <p className="item-meta" style={{ marginBottom: "1rem" }}>
              Integração: {wa.integration}
            </p>
          )}

          <div className="wa-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !wa.configured}
              onClick={onReconnect}
            >
              {busy ? "Aguarde…" : "Reconectar (QR)"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy || !wa.configured}
              onClick={onRefresh}
            >
              Atualizar status
            </button>
            {user?.role === "installer" && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || !wa.configured}
                onClick={onDisconnect}
                style={{ color: "var(--danger)" }}
              >
                Desconectar
              </button>
            )}
          </div>

          {(qr || pairingCode) && (
            <div className="wa-qr-panel">
              {qr && (
                <img src={qr} alt="QR Code WhatsApp" className="wa-qr-img" />
              )}
              {pairingCode && (
                <p className="wa-pairing">
                  Código de pareamento: <code>{pairingCode}</code>
                </p>
              )}
              {hint && <p className="item-meta">{hint}</p>}
            </div>
          )}

          {wa.webhookUrl && (
            <div className="wa-webhook">
              <h3 style={{ fontSize: "0.95rem", margin: "1.25rem 0 0.5rem" }}>
                Webhook (configure na Evolution)
              </h3>
              <code className="wa-webhook-url">{wa.webhookUrl}</code>
              <p className="item-meta" style={{ marginTop: "0.5rem" }}>
                Evento de mensagem recebida → workflow n8n. A URL pública do
                n8n deve ser a mesma cadastrada no painel da instância.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem" }}>Variáveis no serviço agente-ia</h2>
        <ul
          style={{
            margin: 0,
            paddingLeft: "1.2rem",
            color: "var(--muted)",
            fontSize: "0.9rem",
          }}
        >
          <li>
            <code>EVOLUTION_BASE_URL</code> — URL interna (ex.{" "}
            <code>http://evolution:8080</code>)
          </li>
          <li>
            <code>EVOLUTION_API_KEY</code> — apikey da instância
          </li>
          <li>
            <code>EVOLUTION_INSTANCE</code> — nome exato da instância
          </li>
          <li>
            <code>N8N_WHATSAPP_WEBHOOK_URL</code> — opcional, só para exibir
            aqui
          </li>
        </ul>
      </div>

      <p style={{ fontSize: "0.9rem", marginTop: "1rem" }}>
        <Link to="/">← Início</Link>
      </p>
    </>
  );
}
