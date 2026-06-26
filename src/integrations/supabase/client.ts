// Browser-safe Supabase client. Uses publishable/anon key.
// Values are injected at build time via vite `define` from BYO_SUPABASE_* env vars.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const __BYO_SUPABASE_URL__: string;
declare const __BYO_SUPABASE_PUBLISHABLE_KEY__: string;

export const SUPABASE_URL = __BYO_SUPABASE_URL__;
export const SUPABASE_PUBLISHABLE_KEY = __BYO_SUPABASE_PUBLISHABLE_KEY__;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

let _client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase not configured. Set BYO_SUPABASE_URL and BYO_SUPABASE_PUBLISHABLE_KEY secrets and rebuild.",
    );
  }
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}
