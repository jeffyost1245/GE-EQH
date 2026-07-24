// Resolved Supabase configuration.
//
// Values pasted into hosting dashboards routinely pick up stray leading or
// trailing whitespace (a trailing newline in the key makes the browser
// reject the request outright, which surfaces as a confusing "can't reach
// server"), so everything is trimmed here rather than trusted as-is.
//
// The project URL is not a secret — it is visible in every request the
// browser makes — so it falls back to this project's known URL when the
// environment variable is absent. The env var still wins when set, which
// is what makes it possible to point the app at a different project.

const FALLBACK_SUPABASE_URL = "https://lsbamumctmdprxncmgzi.supabase.co";

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

export const SUPABASE_URL =
  clean(process.env.NEXT_PUBLIC_SUPABASE_URL) || FALLBACK_SUPABASE_URL;

export const SUPABASE_ANON_KEY = clean(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
