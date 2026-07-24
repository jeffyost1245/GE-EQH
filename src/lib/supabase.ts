import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      // Named explicitly so a misconfigured deploy is diagnosable from the
      // error alone rather than looking like a dead network.
      throw new Error(
        `Supabase is not configured (url: ${
          SUPABASE_URL ? "ok" : "missing"
        }, key: ${SUPABASE_ANON_KEY ? "ok" : "missing"})`
      );
    }
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
  }
  return client;
}
