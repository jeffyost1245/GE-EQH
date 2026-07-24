import { NextResponse } from "next/server";

// Diagnostic endpoint: reports which configuration the running deployment
// can actually see, without exposing secret values. Used to tell apart
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
    supabaseUrl: describe(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: describe(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    appPassword: { set: Boolean(process.env.APP_PASSWORD) },
    relatedEnvNames: relatedNames,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
