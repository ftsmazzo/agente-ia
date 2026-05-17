import type pg from "pg";
import type { ExtractedMessage } from "../lib/extract-message.js";

export async function upsertLeadFromMessage(
  pool: pg.Pool,
  phone: string,
  message: string,
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
    const actionResult = await pool.query(
      `INSERT INTO app.lead_actions (phone, property_code, status, updated_at)
       SELECT $1, $2, 'qualification', NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM app.lead_actions la
         WHERE la.phone = $1
           AND COALESCE(la.property_code, '') = COALESCE($2::varchar, '')
       )
       RETURNING true AS inserted`,
      [phone, extracted.propertyCode],
    );
    actionCreated = actionResult.rowCount > 0;
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
