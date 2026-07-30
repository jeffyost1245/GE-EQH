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
  try {
    const parsed = JSON.parse(
      decodeURIComponent(match.slice(CREW_COOKIE.length + 1))
    );
    if (typeof parsed?.id === "string") {
      return { id: parsed.id, name: parsed.name ?? "" };
    }
  } catch {
    // Malformed cookie: treat as signed out rather than guessing.
  }
  return null;
}

/** Foreman id for data queries; throws so a bug can't silently read another crew. */
export function requireCrewId(): string {
  const crew = currentCrew();
  if (!crew) throw new Error("No crew selected");
  return crew.id;
}
