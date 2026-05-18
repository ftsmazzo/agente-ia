/**
 * Núcleo do import de planilha → app.properties (API portal + startup).
 */
import XLSX from "xlsx";

const CODE_RE = /^[A-Z]{2}\d{4}$/;

function cell(row, index) {
  const v = row[index];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function parseNumber(raw) {
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function parseSmallInt(raw) {
  const n = parseNumber(raw);
  if (n === null) return null;
  return Math.min(32767, Math.max(0, n));
}

function formatBrl(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildCard(fields, link) {
  const label = fields.property_code;
  const valor =
    fields.valor_venda !== null ? formatBrl(fields.valor_venda) : null;
  const headline = [fields.tipo, fields.bairro ? `no ${fields.bairro}` : null, valor]
    .filter(Boolean)
    .join(" · ");
  const details = [
    fields.dormitorios !== null ? `${fields.dormitorios} dorm.` : null,
    fields.suites !== null && fields.suites > 0 ? `${fields.suites} suíte(s)` : null,
    fields.vagas !== null && fields.vagas > 0 ? `${fields.vagas} vaga(s)` : null,
    fields.area_m2 !== null ? `${fields.area_m2} m²` : null,
    fields.condominio ? `Cond.: ${fields.condominio}` : null,
    fields.cidade ? fields.cidade : null,
  ].filter(Boolean);

  const lines = [label];
  if (headline) lines.push(headline);
  if (details.length) lines.push(details.join(" · "));
  if (link) lines.push(`Link: ${link}`);
  return lines.join("\n");
}

export function rowToProperty(row, brandWebsite) {
  const status = cell(row, 0);
  const code = cell(row, 1).toUpperCase();
  if (!CODE_RE.test(code)) return null;

  const active = status.toLowerCase() === "ativo";
  const tipo = cell(row, 3) || null;
  const endereco = [cell(row, 5), cell(row, 6)].filter(Boolean).join(", ");
  const bairro = cell(row, 7) || null;
  const condominio = cell(row, 8) || null;
  const cidade = cell(row, 9) || null;
  const valorVenda = parseNumber(cell(row, 10));
  const dormitorios = parseSmallInt(cell(row, 16));
  const suites = parseSmallInt(cell(row, 17));
  const vagas = parseSmallInt(cell(row, 18));
  const areaM2 =
    parseNumber(cell(row, 21)) ?? parseNumber(cell(row, 22));

  const website = (brandWebsite ?? "").replace(/\/$/, "");
  const link = website ? `${website}/imovel/${code}` : null;

  const fields = {
    property_code: code,
    status,
    tipo,
    bairro,
    valor_venda: valorVenda,
    dormitorios,
    suites,
    vagas,
    area_m2: areaM2,
    condominio,
    cidade,
  };

  return {
    property_code: code,
    status_label: status || null,
    active,
    tipo,
    finalidade: cell(row, 4) || null,
    bairro,
    cidade,
    condominio,
    endereco_interno: endereco || null,
    valor_venda: valorVenda,
    dormitorios,
    suites,
    vagas,
    area_m2: areaM2,
    link,
    card_text: buildCard(fields, link),
    raw_row: { ref: code, status, tipo, bairro, cidade },
  };
}

export function parsePropertiesFromBuffer(buffer, brandWebsite = "") {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const properties = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0) continue;
    const parsed = rowToProperty(row, brandWebsite);
    if (parsed) properties.push(parsed);
  }
  return properties;
}

const UPSERT_SQL = `INSERT INTO app.properties (
   property_code, status_label, active, tipo, finalidade, bairro, cidade,
   condominio, endereco_interno, valor_venda, dormitorios, suites, vagas,
   area_m2, link, card_text, raw_row, imported_at, updated_at
 ) VALUES (
   $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, NOW(), NOW()
 )
 ON CONFLICT (property_code) DO UPDATE SET
   status_label = EXCLUDED.status_label,
   active = EXCLUDED.active,
   tipo = EXCLUDED.tipo,
   finalidade = EXCLUDED.finalidade,
   bairro = EXCLUDED.bairro,
   cidade = EXCLUDED.cidade,
   condominio = EXCLUDED.condominio,
   endereco_interno = EXCLUDED.endereco_interno,
   valor_venda = EXCLUDED.valor_venda,
   dormitorios = EXCLUDED.dormitorios,
   suites = EXCLUDED.suites,
   vagas = EXCLUDED.vagas,
   area_m2 = EXCLUDED.area_m2,
   link = EXCLUDED.link,
   card_text = EXCLUDED.card_text,
   raw_row = EXCLUDED.raw_row,
   updated_at = NOW()`;

/**
 * @param {import('pg').Pool | import('pg').Client} db
 */
export async function importPropertiesToDb(db, properties) {
  let upserted = 0;
  for (const p of properties) {
    await db.query(UPSERT_SQL, [
      p.property_code,
      p.status_label,
      p.active,
      p.tipo,
      p.finalidade,
      p.bairro,
      p.cidade,
      p.condominio,
      p.endereco_interno,
      p.valor_venda,
      p.dormitorios,
      p.suites,
      p.vagas,
      p.area_m2,
      p.link,
      p.card_text,
      JSON.stringify(p.raw_row),
    ]);
    upserted += 1;
  }
  const activeCount = properties.filter((p) => p.active).length;
  return { upserted, activeCount, total: properties.length };
}

export async function importPropertiesFromBuffer(db, buffer, brandWebsite = "") {
  const properties = parsePropertiesFromBuffer(buffer, brandWebsite);
  if (!properties.length) {
    return { upserted: 0, activeCount: 0, total: 0, error: "no_valid_rows" };
  }
  const result = await importPropertiesToDb(db, properties);
  return { ...result, error: null };
}
