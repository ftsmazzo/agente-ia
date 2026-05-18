import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type pg from "pg";
import * as jose from "jose";

export type PortalRole = "installer" | "client";

export type PortalUser = {
  id: number;
  email: string;
  name: string;
  role: PortalRole;
};

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, SCRYPT_PARAMS);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const derived = scryptSync(password, salt, 64, SCRYPT_PARAMS);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function rowToUser(row: {
  id: number;
  email: string;
  name: string;
  role: PortalRole;
}): PortalUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

export async function countPortalUsers(pool: pg.Pool): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM app.portal_users WHERE active = TRUE`,
  );
  return Number(rows[0]?.count ?? 0);
}

export async function createPortalUser(
  pool: pg.Pool,
  params: {
    email: string;
    password: string;
    name: string;
    role: PortalRole;
  },
): Promise<PortalUser> {
  const email = params.email.trim().toLowerCase();
  const passwordHash = hashPassword(params.password);

  const { rows } = await pool.query<{
    id: number;
    email: string;
    name: string;
    role: PortalRole;
  }>(
    `INSERT INTO app.portal_users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role`,
    [email, passwordHash, params.name.trim(), params.role],
  );

  return rowToUser(rows[0]);
}

export async function authenticatePortalUser(
  pool: pg.Pool,
  email: string,
  password: string,
): Promise<PortalUser | null> {
  const normalized = email.trim().toLowerCase();
  const { rows } = await pool.query<{
    id: number;
    email: string;
    name: string;
    role: PortalRole;
    password_hash: string;
  }>(
    `SELECT id, email, name, role, password_hash
     FROM app.portal_users
     WHERE email = $1 AND active = TRUE`,
    [normalized],
  );

  const row = rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return rowToUser(row);
}

export async function getPortalUserById(
  pool: pg.Pool,
  id: number,
): Promise<PortalUser | null> {
  const { rows } = await pool.query<{
    id: number;
    email: string;
    name: string;
    role: PortalRole;
  }>(
    `SELECT id, email, name, role
     FROM app.portal_users WHERE id = $1 AND active = TRUE`,
    [id],
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function signPortalToken(
  user: PortalUser,
  jwtSecret: string,
): Promise<string> {
  const secret = new TextEncoder().encode(jwtSecret);
  return new jose.SignJWT({
    sub: String(user.id),
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyPortalToken(
  token: string,
  jwtSecret: string,
): Promise<{ userId: number; email: string; role: PortalRole } | null> {
  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jose.jwtVerify(token, secret);
    const sub = payload.sub;
    if (!sub) return null;
    const userId = Number(sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    const role = payload.role === "installer" ? "installer" : "client";
    const email = typeof payload.email === "string" ? payload.email : "";
    return { userId, email, role };
  } catch {
    return null;
  }
}

/** Hash estável para logs (nunca logar senha). */
export function fingerprintEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 12);
}
