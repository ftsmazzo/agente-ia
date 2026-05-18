import { FormEvent, useEffect, useState } from "react";
import { api, type CatalogStats } from "../api.js";

export function CatalogPage() {
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const { catalog } = await api.getCatalog();
    setStats(catalog);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Erro"));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const result = await api.importCatalog(file);
      setMessage(
        `Importado: ${result.upserted} itens (${result.activeCount} ativos).`,
      );
      setFile(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no import");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Catálogo</h1>
      <p style={{ color: "var(--muted)" }}>
        Planilha Excel com códigos AP#### / CA#### na coluna B (mesmo formato da
        planilha Imoveis.xlsx).
      </p>

      {stats && (
        <div className="card">
          <h2>Resumo</h2>
          <div className="stats">
            <div className="stat">
              <strong>{stats.active}</strong>
              <span>Ativos</span>
            </div>
            <div className="stat">
              <strong>{stats.total}</strong>
              <span>Total na base</span>
            </div>
          </div>
          {stats.lastImportedAt && (
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>
              Último import:{" "}
              {new Date(stats.lastImportedAt).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
      )}

      {message && <p style={{ color: "#6bcf8e" }}>{message}</p>}
      {error && <p className="error">{error}</p>}

      <form onSubmit={onSubmit} className="card">
        <h2>Atualizar planilha</h2>
        <label>Arquivo .xlsx</label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!file || loading}
        >
          {loading ? "Importando…" : "Importar catálogo"}
        </button>
      </form>
    </>
  );
}
