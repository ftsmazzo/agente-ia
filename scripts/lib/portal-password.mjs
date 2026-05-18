import { randomBytes, scryptSync } from "node:crypto";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Mesmo formato que portal-auth-service.ts (scrypt). */
export function hashPortalPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, SCRYPT_PARAMS);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}
