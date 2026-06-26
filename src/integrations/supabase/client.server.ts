// Server-only Supabase admin client (service role). NEVER import from browser code.
// The .server.ts suffix is bundler-enforced — client imports of this file fail the build.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.BYO_SUPABASE_URL;
  const key = process.env.BYO_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("BYO_SUPABASE_URL / BYO_SUPABASE_SERVICE_ROLE_KEY not set");
  }
  if (!_admin) {
    _admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
