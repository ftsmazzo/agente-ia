#!/usr/bin/env node
/**
 * Importa planilha de imóveis para app.properties.
 * Env: DATABASE_URL, PROPERTIES_XLSX_PATH, BRAND_WEBSITE (opcional, para links)
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
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

function rowToProperty(row, brandWebsite) {
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
    raw_row: {
      ref: code,
      status,
      tipo,
      bairro,
      cidade,
    },
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("[import-properties] DATABASE_URL is required");
    process.exit(1);
  }

  const xlsxPath =
    process.env.PROPERTIES_XLSX_PATH?.trim() ||
    path.join(process.cwd(), "planilha", "Imoveis.xlsx");

  if (!fs.existsSync(xlsxPath)) {
    console.log(`[import-properties] arquivo não encontrado (${xlsxPath}), pulando`);
    process.exit(0);
  }

  const brandWebsite = process.env.BRAND_WEBSITE?.trim() ?? "";

  console.log(`[import-properties] lendo ${xlsxPath}`);
  const workbook = XLSX.readFile(xlsxPath, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const properties = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length === 0) continue;
    const parsed = rowToProperty(row, brandWebsite);
    if (parsed) properties.push(parsed);
  }

  if (!properties.length) {
    console.warn("[import-properties] nenhuma linha válida na planilha");
    process.exit(0);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  let upserted = 0;
  for (const p of properties) {
    await client.query(
      `INSERT INTO app.properties (
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
         updated_at = NOW()`,
      [
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
      ],
    );
    upserted += 1;
  }

  const activeCount = properties.filter((p) => p.active).length;
  await client.end();

  console.log(
    `[import-properties] concluído: ${upserted} imóveis (${activeCount} ativos)`,
  );
}

main().catch((err) => {
  console.error("[import-properties] falhou:", err);
  process.exit(1);
});
