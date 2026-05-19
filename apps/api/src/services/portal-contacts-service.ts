import type pg from "pg";
import type { QualificationSnapshot } from "../lib/qualification-extract.js";

export type ContactQualification = {
  budgetMaxBrl: number | null;
  payment: string | null;
  buyingWith: string | null;
  timelineHint: string | null;
  visitRequested: boolean;
  incomeHint: string | null;
};

export type ContactSummary = {
  phone: string;
  displayName: string | null;
  updatedAt: string;
  propertyCode: string | null;
  leadStatus: string | null;
  qualification: ContactQualification | null;
};

function mapQualification(
  raw: QualificationSnapshot | undefined,
): ContactQualification | null {
  if (!raw) return null;
  const hasData =
    raw.budget_max_brl != null ||
    raw.payment ||
    raw.buying_with ||
    raw.timeline_hint ||
    raw.visit_requested ||
    raw.income_hint;
  if (!hasData) return null;
  return {
    budgetMaxBrl: raw.budget_max_brl ?? null,
    payment: raw.payment ?? null,
    buyingWith: raw.buying_with ?? null,
    timelineHint: raw.timeline_hint ?? null,
    visitRequested: Boolean(raw.visit_requested),
    incomeHint: raw.income_hint ?? null,
  };
}

export async function listPortalContacts(
  pool: pg.Pool,
  options?: { limit?: number; offset?: number; search?: string },
): Promise<{ items: ContactSummary[]; total: number }> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);
  const search = options?.search?.trim() ?? "";
  const searchDigits = search.replace(/\D/g, "");
  const hasSearch = search.length > 0;

  const countRes = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM app.contacts c
     WHERE ($1::boolean = FALSE OR c.phone LIKE '%' || $2 || '%' OR c.display_name ILIKE '%' || $3 || '%')`,
    [hasSearch, searchDigits || search, search],
  );
  const total = Number(countRes.rows[0]?.count ?? 0);

  const { rows } = await pool.query<{
    phone: string;
    display_name: string | null;
    updated_at: Date;
    property_code: string | null;
    lead_status: string | null;
    metadata: { qualification?: QualificationSnapshot };
  }>(
    `SELECT
       c.phone,
       c.display_name,
       c.updated_at,
       la.property_code,
       la.status AS lead_status,
       la.metadata
     FROM app.contacts c
     LEFT JOIN LATERAL (
       SELECT property_code, status, metadata
       FROM app.lead_actions
       WHERE phone = c.phone
       ORDER BY updated_at DESC
       LIMIT 1
     ) la ON TRUE
     WHERE ($1::boolean = FALSE OR c.phone LIKE '%' || $2 || '%' OR c.display_name ILIKE '%' || $3 || '%')
     ORDER BY c.updated_at DESC
     LIMIT $4 OFFSET $5`,
    [hasSearch, searchDigits || search, search, limit, offset],
  );

  return {
    total,
    items: rows.map((r) => ({
      phone: r.phone,
      displayName: r.display_name,
      updatedAt: r.updated_at.toISOString(),
      propertyCode: r.property_code,
      leadStatus: r.lead_status,
      qualification: mapQualification(r.metadata?.qualification),
    })),
  };
}
