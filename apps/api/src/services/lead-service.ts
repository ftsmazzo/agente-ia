import type pg from "pg";
import type { ExtractedMessage } from "../lib/extract-message.js";

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
     VALUES ($1, $2, NOW())
     ON CONFLICT (phone) DO UPDATE SET
       display_name = COALESCE(EXCLUDED.display_name, app.contacts.display_name),
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
