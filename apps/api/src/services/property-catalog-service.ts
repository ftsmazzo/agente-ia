import type pg from "pg";
import type { BrandConfig } from "@realty/shared";
import type { RagSearchCriteria } from "../lib/rag-search-criteria.js";
import { rowMatchesCriteria, textMatchesNeighborhood } from "../lib/rag-search-criteria.js";
import {
  formatSpreadsheetListingCard,
  type SpreadsheetListingFields,
} from "../lib/rag-spreadsheet-row.js";
import { formatPropertyKnowledgeBlock } from "./agent-service.js";
import type { ParsedListing } from "../lib/rag-csv-listings.js";

export type PropertyRecord = {
  property_code: string;
  status_label: string | null;
  active: boolean;
  tipo: string | null;
  finalidade: string | null;
  bairro: string | null;
  cidade: string | null;
  condominio: string | null;
  endereco_interno: string | null;
  valor_venda: number | null;
  dormitorios: number | null;
  suites: number | null;
  vagas: number | null;
  area_m2: number | null;
  link: string | null;
  card_text: string | null;
};

type PropertyRow = {
  property_code: string;
  status_label: string | null;
  active: boolean;
  tipo: string | null;
  finalidade: string | null;
  bairro: string | null;
  cidade: string | null;
  condominio: string | null;
  endereco_interno: string | null;
  valor_venda: string | null;
  dormitorios: number | null;
  suites: number | null;
  vagas: number | null;
  area_m2: string | null;
  link: string | null;
  card_text: string | null;
};

function toRecord(row: PropertyRow): PropertyRecord {
  return {
    property_code: row.property_code,
    status_label: row.status_label,
    active: row.active,
    tipo: row.tipo,
    finalidade: row.finalidade,
    bairro: row.bairro,
    cidade: row.cidade,
    condominio: row.condominio,
    endereco_interno: row.endereco_interno,
    valor_venda: row.valor_venda ? Number(row.valor_venda) : null,
    dormitorios: row.dormitorios,
    suites: row.suites,
    vagas: row.vagas,
    area_m2: row.area_m2 ? Number(row.area_m2) : null,
    link: row.link,
    card_text: row.card_text,
  };
}

export function propertyToFields(p: PropertyRecord): SpreadsheetListingFields {
  return {
    property_code: p.property_code,
    status: p.status_label,
    tipo: p.tipo,
    bairro: p.bairro,
    valor_venda: p.valor_venda,
    dormitorios: p.dormitorios,
    suites: p.suites,
    vagas: p.vagas,
    area_m2: p.area_m2 !== null ? Number(p.area_m2) : null,
    condominio: p.condominio,
    cidade: p.cidade,
  };
}

function buildCriteriaRowText(p: PropertyRecord): string {
  const parts = [
    `Referência: ${p.property_code}`,
    p.status_label ? `status: ${p.status_label}` : null,
    p.tipo ? `Tipo: ${p.tipo}` : null,
    p.bairro ? `Bairro: ${p.bairro}` : null,
    p.dormitorios !== null ? `Dormitórios: ${p.dormitorios}` : null,
    p.suites !== null ? `Suítes: ${p.suites}` : null,
    p.vagas !== null ? `Vagas: ${p.vagas}` : null,
    p.cidade ? `Cidade: ${p.cidade}` : null,
  ];
  return parts.filter(Boolean).join(" | ");
}

export function propertyToListing(p: PropertyRecord): ParsedListing {
  return {
    property_code: p.property_code,
    raw: buildCriteriaRowText(p),
    fields: propertyToFields(p),
  };
}

export function propertyToKnowledgeRecord(
  p: PropertyRecord,
  brand: BrandConfig,
): Record<string, unknown> {
  const link =
    p.link ??
    (brand.brandWebsite
      ? `${brand.brandWebsite.replace(/\/$/, "")}/imovel/${p.property_code}`
      : undefined);

  if (p.card_text?.trim()) {
    return {
      property_code: p.property_code,
      card: p.card_text.trim(),
      ...(link ? { link } : {}),
    };
  }

  return {
    property_code: p.property_code,
    card: formatSpreadsheetListingCard(propertyToFields(p), link),
    ...(link ? { link } : {}),
  };
}

export async function countActiveProperties(pool: pg.Pool): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM app.properties WHERE active = TRUE`,
  );
  return Number(rows[0]?.count ?? 0);
}

export async function getPropertyByCode(
  pool: pg.Pool,
  code: string,
): Promise<PropertyRecord | null> {
  const { rows } = await pool.query<PropertyRow>(
    `SELECT property_code, status_label, active, tipo, finalidade, bairro, cidade,
            condominio, endereco_interno, valor_venda::text, dormitorios, suites,
            vagas, area_m2::text, link, card_text
     FROM app.properties
     WHERE property_code = $1 AND active = TRUE`,
    [code.toUpperCase()],
  );
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function searchPropertiesByCriteria(
  pool: pg.Pool,
  criteria: RagSearchCriteria,
  limit = 8,
): Promise<PropertyRecord[]> {
  const conditions = ["active = TRUE"];
  const values: unknown[] = [];

  if (criteria.bedrooms !== null) {
    values.push(criteria.bedrooms);
    conditions.push(`dormitorios = $${values.length}`);
  }

  if (criteria.propertyTypes.length === 1) {
    values.push(`%${criteria.propertyTypes[0]}%`);
    conditions.push(`tipo ILIKE $${values.length}`);
  }

  values.push(Math.min(Math.max(limit * 4, 20), 80));
  const limitParam = values.length;

  const { rows } = await pool.query<PropertyRow>(
    `SELECT property_code, status_label, active, tipo, finalidade, bairro, cidade,
            condominio, endereco_interno, valor_venda::text, dormitorios, suites,
            vagas, area_m2::text, link, card_text
     FROM app.properties
     WHERE ${conditions.join(" AND ")}
     ORDER BY valor_venda NULLS LAST, property_code
     LIMIT $${limitParam}`,
    values,
  );

  const records = rows.map(toRecord);
  const filtered = records.filter((p) =>
    rowMatchesCriteria(buildCriteriaRowText(p), criteria),
  );

  if (criteria.neighborhoods.length > 0) {
    return filtered
      .filter((p) =>
        criteria.neighborhoods.some(
          (n) =>
            (p.bairro && textMatchesNeighborhood(p.bairro, n)) ||
            textMatchesNeighborhood(buildCriteriaRowText(p), n),
        ),
      )
      .slice(0, limit);
  }

  return filtered.slice(0, limit);
}

const MAX_LISTINGS_FOR_LLM = 3;

export function buildKnowledgeBlockFromProperties(
  properties: PropertyRecord[],
  brand: BrandConfig,
  criteria: RagSearchCriteria,
): string {
  if (!properties.length) {
    if (criteria.neighborhoods.length > 0) {
      const bairros = criteria.neighborhoods.join(", ");
      const extra = criteria.bedrooms ? `, ${criteria.bedrooms} quartos` : "";
      return `[DADOS DO SISTEMA]
Nenhum imóvel encontrado na base para: ${bairros}${extra}.
Qualifique o cliente sem inventar anúncios.
[/DADOS DO SISTEMA]`;
    }
    return "";
  }

  const records = properties
    .slice(0, MAX_LISTINGS_FOR_LLM)
    .map((p) => propertyToKnowledgeRecord(p, brand));

  const inner = formatPropertyKnowledgeBlock(records)
    .replace(/^\[DADOS DO SISTEMA\]\n?/, "")
    .replace(/\n?\[\/DADOS DO SISTEMA\]$/, "")
    .trim();

  const header =
    criteria.neighborhoods.length > 0
      ? `[Critérios: ${criteria.neighborhoods.join(", ")}${criteria.bedrooms ? `; ${criteria.bedrooms} quartos` : ""}]\n`
      : "";

  return `${header}[DADOS DO SISTEMA]
${inner}
[/DADOS DO SISTEMA]`;
}
