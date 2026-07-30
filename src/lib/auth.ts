// Session cookies for a multi-crew app.
//
// Passwords now live in the database (one pair per foreman), so the
// middleware can't re-derive a cookie from a password the way it used to.
// Instead each cookie carries the foreman's id alongside an HMAC of it,
// signed with a server-only secret: the app can tell which crew you are
// without a database round trip on every request, and the id can't be
// swapped for another crew's without the secret.
//
// Edge-safe: Web Crypto only.

export const SESSION_COOKIE = "eqh_session";
export const ADMIN_COOKIE = "eqh_admin";
/** Readable by the browser so pages know which crew's data to load. */
export const CREW_COOKIE = "eqh_crew";

const SESSION_SALT = "ge-eqh-session-v2";
const ADMIN_SALT = "ge-eqh-admin-v2";

/**
 * Read a value from the environment, tolerating the stray whitespace that
 * pasting into a hosting dashboard tends to introduce.
 */
export function envValue(name: string): string {
  return (process.env[name] ?? "").trim();
}

/**
 * Secret used to sign session cookies. APP_PASSWORD is no longer typed by
 * anyone — crews use their foreman's password now — so it serves purely
 * as the signing key, which is why it must stay set.
 */
function secret(): string {
  return envValue("APP_PASSWORD");
}

async function sign(value: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${salt}:${secret()}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function makeSessionCookie(foremanId: string): Promise<string> {
  return `${foremanId}.${await sign(foremanId, SESSION_SALT)}`;
}

export async function makeAdminCookie(foremanId: string): Promise<string> {
  return `${foremanId}.${await sign(foremanId, ADMIN_SALT)}`;
}

/**
 * Return the foreman id a cookie vouches for, or null if it's missing,
 * malformed, or not signed with our secret.
 */
async function readCookie(
  value: string | undefined,
  salt: string
): Promise<string | null> {
  if (!value || !secret()) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const foremanId = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const expected = await sign(foremanId, salt);
  // Constant-time-ish: compare full strings of equal length.
  if (signature.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0 ? foremanId : null;
}

export function readSessionCookie(
  value: string | undefined
): Promise<string | null> {
  return readCookie(value, SESSION_SALT);
}

export function readAdminCookie(
  value: string | undefined
): Promise<string | null> {
  return readCookie(value, ADMIN_SALT);
}
