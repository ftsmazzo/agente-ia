#!/usr/bin/env node
/**
 * Garante usuários do portal a partir do env (implantação EasyPanel).
 * - Cria só se o e-mail ainda não existir (não recria a cada restart).
 * - Atualiza senha/nome só se PORTAL_SYNC_PASSWORD_FROM_ENV=true.
 *
 * Env:
 *   PORTAL_ADMIN_EMAIL, PORTAL_ADMIN_PASSWORD, PORTAL_ADMIN_NAME (opcional)
 *   PORTAL_CLIENT_EMAIL, PORTAL_CLIENT_PASSWORD, PORTAL_CLIENT_NAME (opcional)
 *   PORTAL_SEED_ON_START=true|false (default: true)
 *   PORTAL_SYNC_PASSWORD_FROM_ENV=true|false (default: false)
 */
import pg from "pg";
import { hashPortalPassword } from "./lib/portal-password.mjs";

const USER_SPECS = [
  {
    emailEnv: "PORTAL_ADMIN_EMAIL",
    passwordEnv: "PORTAL_ADMIN_PASSWORD",
    nameEnv: "PORTAL_ADMIN_NAME",
    role: "installer",
    defaultName: "Administrador",
  },
  {
    emailEnv: "PORTAL_CLIENT_EMAIL",
    passwordEnv: "PORTAL_CLIENT_PASSWORD",
    nameEnv: "PORTAL_CLIENT_NAME",
    role: "client",
    defaultName: "Cliente",
  },
];

async function ensurePortalUser(client, spec, syncPassword) {
  const email = process.env[spec.emailEnv]?.trim().toLowerCase();
  const password = process.env[spec.passwordEnv]?.trim();
  if (!email || !password) return null;

  if (password.length < 8) {
    console.error(
      `[portal-seed] ${spec.emailEnv}: senha deve ter pelo menos 8 caracteres`,
    );
    process.exit(1);
  }

  const name =
    process.env[spec.nameEnv]?.trim() || spec.defaultName;
  const passwordHash = hashPortalPassword(password);

  const existing = await client.query(
    `SELECT id, role FROM app.portal_users WHERE email = $1`,
    [email],
  );

  if (existing.rows.length === 0) {
    await client.query(
      `INSERT INTO app.portal_users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)`,
      [email, passwordHash, name, spec.role],
    );
    console.log(`[portal-seed] usuário criado: ${email} (${spec.role})`);
    return "created";
  }

  if (syncPassword) {
    await client.query(
      `UPDATE app.portal_users
       SET password_hash = $1, name = $2, role = $3, active = TRUE, updated_at = NOW()
       WHERE email = $4`,
      [passwordHash, name, spec.role, email],
    );
    console.log(`[portal-seed] usuário atualizado (env): ${email}`);
    return "updated";
  }

  console.log(`[portal-seed] usuário já existe (sem alteração): ${email}`);
  return "skipped";
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.log("[portal-seed] DATABASE_URL ausente, ignorado");
  process.exit(0);
}

if (process.env.PORTAL_SEED_ON_START === "false") {
  console.log("[portal-seed] PORTAL_SEED_ON_START=false, ignorado");
  process.exit(0);
}

const hasAnyCredential = USER_SPECS.some(
  (s) =>
    process.env[s.emailEnv]?.trim() && process.env[s.passwordEnv]?.trim(),
);

if (!hasAnyCredential) {
  console.log(
    "[portal-seed] nenhum PORTAL_*_EMAIL/PASSWORD definido, ignorado",
  );
  process.exit(0);
}

const syncPassword = process.env.PORTAL_SYNC_PASSWORD_FROM_ENV === "true";

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  for (const spec of USER_SPECS) {
    await ensurePortalUser(client, spec, syncPassword);
  }
} catch (err) {
  console.error("[portal-seed] falhou:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
