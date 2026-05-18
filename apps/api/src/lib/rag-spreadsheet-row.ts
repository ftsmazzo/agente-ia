import type { ParsedListing } from "./rag-csv-listings.js";
import { formatBrlFromSheet } from "./format-brl.js";

const REF_PATTERN = /Referência:\s*([A-Z]{2}\d{4})\b/i;

export type SpreadsheetListingFields = {
  property_code: string;
  tipo: string | null;
  bairro: string | null;
  valor_venda: number | null;
  dormitorios: number | null;
  suites: number | null;
  vagas: number | null;
  area_m2: number | null;
  condominio: string | null;
  cidade: string | null;
  status: string | null;
};

function extractPipeField(content: string, label: string): string | null {
  const re = new RegExp(`${label}:\\s*([^|]+)`, "i");
  const raw = re.exec(content)?.[1]?.trim();
  if (!raw || raw === "0") return null;
  return raw;
}

function parseSheetNumber(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Lê campos do chunk `Planilha | Linha | Referência: AP#### | ...` */
export function parseSpreadsheetListing(
  content: string,
): SpreadsheetListingFields | null {
  const ref = content.match(REF_PATTERN);
  if (!ref?.[1]) return null;

  const valorRaw = content.match(/R\$\s*Venda:\s*([^|]+)/i)?.[1]?.trim() ?? null;

  return {
    property_code: ref[1].toUpperCase(),
    status: extractPipeField(content, "status"),
    tipo: extractPipeField(content, "Tipo"),
    bairro: extractPipeField(content, "Bairro"),
    valor_venda: parseSheetNumber(valorRaw),
    dormitorios: parseSheetNumber(extractPipeField(content, "Dormitórios")),
    suites: parseSheetNumber(extractPipeField(content, "Suítes")),
    vagas: parseSheetNumber(extractPipeField(content, "Vagas")),
    area_m2:
      parseSheetNumber(extractPipeField(content, "Área")) ??
      parseSheetNumber(extractPipeField(content, "Área total")),
    condominio: extractPipeField(content, "Edf\\. / Cond\\."),
    cidade: extractPipeField(content, "Cidade"),
  };
}

/** Chunks do RAG: uma linha da planilha = um imóvel */
export function parseSpreadsheetRowChunks(content: string): ParsedListing[] {
  const fields = parseSpreadsheetListing(content);
  if (!fields) return [];

  return [
    {
      property_code: fields.property_code,
      raw: content,
      fields,
    },
  ];
}

export function extractCodeFromSpreadsheetText(
  text: string,
): string | null {
  const match = text.match(REF_PATTERN);
  return match?.[1]?.toUpperCase() ?? null;
}

export function extractBairroFromSpreadsheetText(text: string): string | null {
  return parseSpreadsheetListing(text)?.bairro ?? null;
}

/** Ficha legível para o LLM montar texto persuasivo no WhatsApp */
export function formatSpreadsheetListingCard(
  fields: SpreadsheetListingFields,
  link?: string,
  index?: number,
): string {
  const label = index !== undefined ? `IMÓVEL ${index} — ${fields.property_code}` : fields.property_code;
  const valor =
    fields.valor_venda !== null
      ? formatBrlFromSheet(fields.valor_venda)
      : null;

  const headlineParts = [
    fields.tipo,
    fields.bairro ? `no ${fields.bairro}` : null,
    valor,
  ].filter(Boolean);

  const detailParts = [
    fields.dormitorios !== null ? `${fields.dormitorios} dorm.` : null,
    fields.suites !== null && fields.suites > 0
      ? `${fields.suites} suíte(s)`
      : null,
    fields.vagas !== null && fields.vagas > 0
      ? `${fields.vagas} vaga(s)`
      : null,
    fields.area_m2 !== null ? `${fields.area_m2} m²` : null,
    fields.condominio ? `Cond.: ${fields.condominio}` : null,
    fields.cidade ? fields.cidade : null,
  ].filter(Boolean);

  const lines = [label];
  if (headlineParts.length > 0) {
    lines.push(headlineParts.join(" · "));
  }
  if (detailParts.length > 0) {
    lines.push(detailParts.join(" · "));
  }
  if (link) {
    lines.push(`Link: ${link}`);
  }
  return lines.join("\n");
}
