import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

/**
 * Cliente Supabase con **service_role** — bypassa RLS (doc 08 §4, doc 10 §6).
 * SOLO server-side (worker, route handlers de sistema). NUNCA importar desde
 * código que llegue al cliente. La key vive en `.env.local` (git-ignored).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurada (server-only)");
  return createClient<Database>(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
