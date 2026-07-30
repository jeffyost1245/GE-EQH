"use client";

// Which crew this browser is signed in as. Read from a plain cookie so
// pages know whose machines and hours to load without an extra request.
// It is not a credential: the signed httpOnly cookie is what grants
// access, and the middleware checks that on every request.

import { CREW_COOKIE } from "./auth";

export interface CurrentCrew {
  id: string;
  name: string;
}

export function currentCrew(): CurrentCrew | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CREW_COOKIE}=`));
  if (!match) return null;

  // Decode repeatedly: an earlier release wrote this cookie double-encoded,
  // and phones still carrying one should keep working rather than being
  // silently treated as signed out.
  let value = match.slice(CREW_COOKIE.length + 1);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed?.id === "string") {
        return { id: parsed.id, name: parsed.name ?? "" };
      }
      return null;
    } catch {
      let decoded: string;
      try {
        decoded = decodeURIComponent(value);
      } catch {
        return null;
      }
      if (decoded === value) return null; // nothing left to unwrap
      value = decoded;
    }
  }
  return null;
}

/** Foreman id for data queries; throws so a bug can't silently read another crew. */
export function requireCrewId(): string {
  const crew = currentCrew();
  if (!crew) throw new Error("No crew selected");
  return crew.id;
}
