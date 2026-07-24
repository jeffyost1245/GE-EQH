// Two shared passwords, no individual accounts:
//   APP_PASSWORD       — lets the crew into the app at all
//   APP_ADMIN_PASSWORD — additionally unlocks machine/crew management
//
// Each cookie stores a SHA-256 digest of its password plus a distinct
// salt, so middleware can recompute and compare without storing anything
// server-side, and changing a password invalidates its existing sessions.
// Different salts mean the crew cookie can never satisfy the admin check.
// Edge-safe (Web Crypto only).

export const SESSION_COOKIE = "eqh_session";
export const ADMIN_COOKIE = "eqh_admin";

const SALT = "ge-eqh-v1";
const ADMIN_SALT = "ge-eqh-admin-v1";

/**
 * Read a password from the environment, tolerating the stray whitespace
 * that pasting into a hosting dashboard tends to introduce.
 */
export function envPassword(name: string): string {
  return (process.env[name] ?? "").trim();
}

async function digest(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function sessionToken(password: string): Promise<string> {
  return digest(`${SALT}:${password}`);
}

export function adminToken(password: string): Promise<string> {
  return digest(`${ADMIN_SALT}:${password}`);
}
