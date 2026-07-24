// Single shared password. The session cookie stores a SHA-256 digest of
// the password + salt; middleware recomputes and compares, so changing
// APP_PASSWORD invalidates every existing session. Edge-safe (Web Crypto).

export const SESSION_COOKIE = "eqh_session";
const SALT = "ge-eqh-v1";

export async function sessionToken(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${SALT}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
