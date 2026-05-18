import type pg from "pg";
import type { ExtractedMessage } from "../lib/extract-message.js";
import {
  mergeQualificationSnapshots,
  type QualificationSnapshot,
} from "../lib/qualification-extract.js";

export async function upsertLeadFromMessage(
  pool: pg.Pool,
  phone: string,
  extracted: ExtractedMessage,
  displayName?: string | null,
): Promise<{ contactCreated: boolean; actionCreated: boolean }> {
  let contactCreated = false;
  let actionCreated = false;

  const contactResult = await pool.query(
    `INSERT INTO app.contacts (phone, display_name, updated_at)
     VALUES ($1::text, $2::text, NOW())
     ON CONFLICT (phone) DO UPDATE SET
       display_name = CASE
         WHEN EXCLUDED.display_name IS NOT NULL AND TRIM(EXCLUDED.display_name) <> ''
         THEN EXCLUDED.display_name
         ELSE app.contacts.display_name
       END,
       updated_at = NOW()
     RETURNING (xmax = 0) AS inserted`,
    [phone, displayName ?? null],
  );
  contactCreated = Boolean(contactResult.rows[0]?.inserted);

  if (extracted.hasPropertyInterest || extracted.propertyCode) {
    const propertyCode = extracted.propertyCode ?? null;
    // $1 reutilizado no mesmo prepared statement quebra tipagem no Postgres — usar $3 para phone no NOT EXISTS
    const actionResult = await pool.query(
      `INSERT INTO app.lead_actions (phone, property_code, status, updated_at)
       SELECT $1::text, $2::text, 'qualification', NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM app.lead_actions la
         WHERE la.phone = $3::text
           AND COALESCE(la.property_code, '') = COALESCE($2::text, '')
       )
       RETURNING true AS inserted`,
      [phone, propertyCode, phone],
    );
    actionCreated = (actionResult.rowCount ?? 0) > 0;
  }

  return { contactCreated, actionCreated };
}

export async function getContactDisplayName(
  pool: pg.Pool,
  phone: string,
): Promise<string | null> {
  const { rows } = await pool.query<{ display_name: string | null }>(
    `SELECT display_name FROM app.contacts WHERE phone = $1`,
    [phone],
  );
  return rows[0]?.display_name ?? null;
}

/** Grava qualificação em metadata (determinístico — não usa saída do LLM). */
export async function mergeLeadQualification(
  pool: pg.Pool,
  phone: string,
  propertyCode: string | null,
  incoming: Partial<QualificationSnapshot>,
): Promise<boolean> {
  await pool.query(
    `INSERT INTO app.contacts (phone, updated_at)
     VALUES ($1, NOW())
     ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()`,
    [phone],
  );

  const code = propertyCode ?? null;
  const { rows } = await pool.query<{
    id: number;
    metadata: { qualification?: QualificationSnapshot };
  }>(
    `SELECT id, metadata FROM app.lead_actions
     WHERE phone = $1 AND COALESCE(property_code, '') = COALESCE($2::text, '')
     ORDER BY updated_at DESC LIMIT 1`,
    [phone, code],
  );

  const existing = rows[0]?.metadata?.qualification;
  const merged = mergeQualificationSnapshots(existing, incoming);

  if (rows[0]) {
    await pool.query(
      `UPDATE app.lead_actions
       SET metadata = metadata || jsonb_build_object('qualification', $2::jsonb),
           status = CASE WHEN status = 'new' THEN 'qualification' ELSE status END,
           updated_at = NOW()
       WHERE id = $1`,
      [rows[0].id, JSON.stringify(merged)],
    );
    return true;
  }

  await pool.query(
    `INSERT INTO app.lead_actions (phone, property_code, status, metadata, updated_at)
     VALUES ($1, $2, 'qualification', jsonb_build_object('qualification', $3::jsonb), NOW())`,
    [phone, code, JSON.stringify(merged)],
  );
  return true;
}
