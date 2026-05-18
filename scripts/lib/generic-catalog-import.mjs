/**
 * Import CSV genérico → app.catalog_meta + app.catalog_items
 * Primeira linha = cabeçalhos; cada coluna vira campo em fields (JSON).
 */

const CODE_HEADER_HINTS = [
  "codigo",
  "code",
  "sku",
  "ref",
  "referencia",
  "referência",
  "id",
  "item",
  "item_code",
];

const TITLE_HEADER_HINTS = [
  "nome",
  "titulo",
  "título",
  "title",
  "descricao",
  "descrição",
  "description",
  "produto",
  "servico",
  "serviço",
  "name",
];

const ACTIVE_HEADER_HINTS = ["status", "ativo", "active", "situacao", "situação"];

const INACTIVE_VALUES = new Set([
  "inativo",
  "inactive",
  "nao",
  "não",
  "no",
  "0",
  "false",
  "vendido",
  "indisponivel",
  "indisponível",
]);

export function normalizeHeader(raw) {
  const base = String(raw ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  const key = base
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return key || "coluna";
}

function detectDelimiter(firstLine) {
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

/** Parser CSV com aspas e delimitador , ou ; */
export function parseCsvText(text) {
  const raw = text.replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { headers: [], rows: [], delimiter: "," };
  }

  const delimiter = detectDelimiter(lines[0]);

  function parseLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  const headerCells = parseLine(lines[0]);
  const keys = [];
  const seen = new Map();
  for (const h of headerCells) {
    let key = normalizeHeader(h);
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n > 1) key = `${key}_${n}`;
    keys.push(key);
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseLine(lines[i]);
    if (cells.every((c) => !c)) continue;
    const fields = {};
    for (let c = 0; c < keys.length; c += 1) {
      const val = cells[c] ?? "";
      if (val !== "") fields[keys[c]] = val;
    }
    if (Object.keys(fields).length > 0) rows.push(fields);
  }

  const columns = keys.map((key, i) => ({
    key,
    label: headerCells[i] || key,
    inferredType: inferColumnType(rows, key),
  }));

  return { columns, rows, delimiter };
}

function inferColumnType(rows, key) {
  let numeric = 0;
  let checked = 0;
  for (const row of rows.slice(0, 50)) {
    const v = row[key];
    if (v === undefined || v === "") continue;
    checked += 1;
    const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
    if (Number.isFinite(n)) numeric += 1;
  }
  if (checked === 0) return "text";
  return numeric / checked >= 0.8 ? "number" : "text";
}

function pickColumn(columns, hints, fallbackIndex = 0) {
  const keys = columns.map((c) => c.key);
  for (const hint of hints) {
    const hit = keys.find((k) => k === hint || k.includes(hint));
    if (hit) return hit;
  }
  return keys[fallbackIndex] ?? null;
}

function isActiveValue(raw, activeKey, fields) {
  if (!activeKey) return true;
  const v = String(fields[activeKey] ?? "")
    .trim()
    .toLowerCase();
  if (!v) return true;
  return !INACTIVE_VALUES.has(v);
}

function buildSearchText(fields) {
  return Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" | ")
    .slice(0, 8000);
}

function buildCardText(itemCode, title, fields) {
  const lines = [itemCode];
  if (title) lines.push(title);
  const rest = Object.entries(fields)
    .filter(([k]) => k !== "item_code")
    .slice(0, 12)
    .map(([k, v]) => `${k}: ${v}`);
  if (rest.length) lines.push(rest.join(" · "));
  return lines.join("\n");
}

function deriveItemCode(fields, codeKey, rowIndex) {
  const raw = codeKey ? String(fields[codeKey] ?? "").trim() : "";
  if (raw) return raw.slice(0, 128);
  return `LINHA-${rowIndex + 1}`;
}

export function analyzeCatalogCsv(buffer) {
  const text = buffer.toString("utf-8");
  const { columns, rows, delimiter } = parseCsvText(text);
  const itemCodeKey =
    pickColumn(columns, CODE_HEADER_HINTS, 0) ?? columns[0]?.key ?? "item_code";
  const titleKey = pickColumn(columns, TITLE_HEADER_HINTS, 1);
  const activeKey = pickColumn(columns, ACTIVE_HEADER_HINTS);

  const sample = rows.slice(0, 5).map((fields, i) => {
    const code = deriveItemCode(fields, itemCodeKey, i);
    return {
      itemCode: code,
      title: titleKey ? String(fields[titleKey] ?? "") : null,
      active: isActiveValue(null, activeKey, fields),
      fields,
    };
  });

  return {
    columns,
    delimiter,
    rowCount: rows.length,
    itemCodeKey,
    titleKey,
    activeKey,
    sample,
  };
}

/**
 * @param {import('pg').Pool | import('pg').Client} db
 */
export async function importCatalogCsv(db, buffer, options = {}) {
  const text = buffer.toString("utf-8");
  const { columns, rows, delimiter } = parseCsvText(text);
  if (!rows.length) {
    return { upserted: 0, activeCount: 0, total: 0, error: "no_rows" };
  }

  const itemCodeKey =
    options.itemCodeKey ??
    pickColumn(columns, CODE_HEADER_HINTS, 0) ??
    columns[0]?.key ??
    "item_code";
  const titleKey =
    options.titleKey ?? pickColumn(columns, TITLE_HEADER_HINTS, 1);
  const activeKey =
    options.activeKey ?? pickColumn(columns, ACTIVE_HEADER_HINTS);

  const query = (sql, params) => db.query(sql, params);

  await query(`DELETE FROM app.catalog_items`);

  let upserted = 0;
  let activeCount = 0;
  const usedCodes = new Set();

  for (let i = 0; i < rows.length; i += 1) {
    const fields = { ...rows[i] };
    let itemCode = deriveItemCode(fields, itemCodeKey, i);
    if (usedCodes.has(itemCode)) {
      itemCode = `${itemCode}-${i + 1}`.slice(0, 128);
    }
    usedCodes.add(itemCode);

    const title = titleKey ? String(fields[titleKey] ?? "").trim() : null;
    const active = isActiveValue(null, activeKey, fields);
    if (active) activeCount += 1;

    fields._card = buildCardText(itemCode, title, fields);
    const searchText = buildSearchText(fields);

    await query(
      `INSERT INTO app.catalog_items (item_code, title, active, fields, search_text, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
       ON CONFLICT (item_code) DO UPDATE SET
         title = EXCLUDED.title,
         active = EXCLUDED.active,
         fields = EXCLUDED.fields,
         search_text = EXCLUDED.search_text,
         updated_at = NOW()`,
      [itemCode, title, active, JSON.stringify(fields), searchText],
    );
    upserted += 1;
  }

  await query(
    `UPDATE app.catalog_meta SET
       columns = $1::jsonb,
       item_code_key = $2,
       title_key = $3,
       active_key = $4,
       source_filename = $5,
       row_count = $6,
       updated_at = NOW()
     WHERE id = 1`,
    [
      JSON.stringify(columns),
      itemCodeKey,
      titleKey,
      activeKey,
      options.filename ?? null,
      upserted,
    ],
  );

  return {
    upserted,
    activeCount,
    total: upserted,
    columns,
    itemCodeKey,
    titleKey,
    activeKey,
    delimiter,
    error: null,
  };
}
