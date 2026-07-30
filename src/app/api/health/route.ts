import { NextResponse } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { envValue } from "@/lib/auth";

// Diagnostic endpoint: reports the configuration the running deployment
// actually resolves, without exposing secret values. Used to tell apart
// "env var missing", "env var misnamed", and "env var truncated".

export const dynamic = "force-dynamic";

function describe(value: string | undefined) {
  if (value === undefined) return { set: false };
  return {
    set: true,
    length: value.length,
    startsWith: value.slice(0, 8),
    endsWith: value.slice(-6),
    hasWhitespace: /\s/.test(value),
  };
}

export async function GET() {
  // Names only — never values — so a misspelled key is visible safely.
  const relatedNames = Object.keys(process.env)
    .filter((n) => /SUPABASE|APP_PASSWORD|NEXT_PUBLIC/i.test(n))
    .sort();

  return NextResponse.json({
    // What the app will actually use, after trimming and fallback.
    effective: {
      url: SUPABASE_URL,
      urlFromEnv: Boolean((process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()),
      keyLength: SUPABASE_ANON_KEY.length,
      keyLooksValid:
        SUPABASE_ANON_KEY.split(".").length === 3 &&
        !/\s/.test(SUPABASE_ANON_KEY),
      // Crew and admin passwords live in the database now, one pair per
      // foreman; this only signs session cookies.
      sessionSecretSet: envValue("APP_PASSWORD").length > 0,
    },
    // The raw environment, for spotting typos and stray whitespace.
    raw: {
      supabaseUrl: describe(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseAnonKey: describe(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      relatedEnvNames: relatedNames,
    },
    vercelEnv: process.env.VERCEL_ENV ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
