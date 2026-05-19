import { FormEvent, useEffect, useState } from "react";
import { api, type CatalogPreview, type CatalogStats } from "../api.js";

export function CatalogPage() {
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CatalogPreview | null>(null);
  const [itemCodeKey, setItemCodeKey] = useState("");
  const [titleKey, setTitleKey] = useState("");
  const [activeKey, setActiveKey] = useState("");
  const [mergeMode, setMergeMode] = useState(false);
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

  function applySavedMapping(catalog: CatalogStats, p: CatalogPreview) {
    const keys = new Set(p.columns.map((c) => c.key));
    if (catalog.itemCodeKey && keys.has(catalog.itemCodeKey)) {
      setItemCodeKey(catalog.itemCodeKey);
    } else {
      setItemCodeKey(p.itemCodeKey);
    }
    if (catalog.titleKey && keys.has(catalog.titleKey)) {
      setTitleKey(catalog.titleKey);
    } else {
      setTitleKey(p.titleKey ?? "");
    }
    if (catalog.activeKey && keys.has(catalog.activeKey)) {
      setActiveKey(catalog.activeKey);
    } else {
      setActiveKey(p.activeKey ?? "");
    }
  }

  async function onAnalyze(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setMessage("");
    setError("");
    setPreview(null);
    try {
      const { preview: p } = await api.previewCatalog(file);
      setPreview(p);
      if (stats) applySavedMapping(stats, p);
      else {
        setItemCodeKey(p.itemCodeKey);
        setTitleKey(p.titleKey ?? "");
        setActiveKey(p.activeKey ?? "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na leitura");
    } finally {
      setLoading(false);
    }
  }

  async function onImport(e: FormEvent) {
    e.preventDefault();
    if (!file || !itemCodeKey) return;
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const result = await api.importCatalog(file, {
        itemCodeKey,
        titleKey: titleKey || undefined,
        activeKey: activeKey || undefined,
        mode: mergeMode ? "merge" : "replace",
      });
      const modeLabel =
        result.mode === "merge" ? "mesclado" : "substituído por completo";
      setMessage(
        `Import ${modeLabel}: ${result.upserted} linha(s) processada(s), ${result.total} itens na base (${result.activeCount} ativos).`,
      );
      setFile(null);
      setPreview(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no import");
    } finally {
      setLoading(false);
    }
  }

  async function onExport() {
    setError("");
    try {
      await api.downloadCatalogCsv();
      setMessage("CSV exportado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na exportação");
    }
  }

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Catálogo</h1>
      <p style={{ color: "var(--muted)" }}>
        CSV com cabeçalho na primeira linha. O sistema descobre as colunas e
        grava cada linha — qualquer nicho (imóveis, produtos, serviços).
      </p>

      {stats && stats.total > 0 && (
        <div className="card">
          <h2>Base atual</h2>
          <div className="stats">
            <div className="stat">
              <strong>{stats.active}</strong>
              <span>Ativos</span>
            </div>
            <div className="stat">
              <strong>{stats.total}</strong>
              <span>Total</span>
            </div>
          </div>
          {stats.columns?.length > 0 && (
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
              Colunas: {stats.columns.map((c) => c.label || c.key).join(", ")}
            </p>
          )}
          {stats.itemCodeKey && (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Último mapeamento: código → <code>{stats.itemCodeKey}</code>
              {stats.titleKey ? `, título → ${stats.titleKey}` : ""}
            </p>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onExport}
            style={{ marginTop: "0.5rem" }}
          >
            Exportar CSV
          </button>
        </div>
      )}

      {message && <p style={{ color: "#6bcf8e" }}>{message}</p>}
      {error && <p className="error">{error}</p>}

      <form onSubmit={onAnalyze} className="card">
        <h2>1. Enviar CSV</h2>
        <label>Arquivo .csv (vírgula ou ponto-e-vírgula)</label>
        <input
          type="file"
          accept=".csv,.txt,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
          }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!file || loading}
        >
          {loading && !preview ? "Lendo…" : "Analisar colunas"}
        </button>
      </form>

      {preview && (
        <form onSubmit={onImport} className="card">
          <h2>2. Confirmar importação</h2>
          <p style={{ color: "var(--muted)" }}>
            {preview.rowCount} linhas · delimitador &quot;{preview.delimiter}
            &quot;
          </p>

          <label className="checks">
            <input
              type="checkbox"
              checked={mergeMode}
              onChange={(e) => setMergeMode(e.target.checked)}
            />
            Mesclar (manter itens que não estão neste CSV; atualizar/somar por
            código)
          </label>
          {!mergeMode && (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              Sem mesclar: apaga o catálogo atual e importa só este arquivo.
            </p>
          )}

          <label>Coluna do código / identificador</label>
          <select
            value={itemCodeKey}
            onChange={(e) => setItemCodeKey(e.target.value)}
            required
          >
            {preview.columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label} ({c.key}) — {c.inferredType}
              </option>
            ))}
          </select>

          <label>Coluna do título (opcional)</label>
          <select
            value={titleKey}
            onChange={(e) => setTitleKey(e.target.value)}
          >
            <option value="">— nenhuma —</option>
            {preview.columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label} ({c.key})
              </option>
            ))}
          </select>

          <label>Coluna de ativo/inativo (opcional)</label>
          <select
            value={activeKey}
            onChange={(e) => setActiveKey(e.target.value)}
          >
            <option value="">— todos ativos —</option>
            {preview.columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label} ({c.key})
              </option>
            ))}
          </select>

          {preview.sample.length > 0 && (
            <>
              <h3 style={{ fontSize: "0.95rem" }}>Amostra</h3>
              <ul className="item-list">
                {preview.sample.map((row) => (
                  <li key={row.itemCode} className="item-list-row">
                    <div>
                      <strong>{row.itemCode}</strong>
                      {row.title && (
                        <p className="item-meta">{row.title}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Importando…" : "Importar no catálogo"}
          </button>
        </form>
      )}
    </>
  );
}
