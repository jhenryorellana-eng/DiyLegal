import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

/**
 * Cliente Supabase para el navegador (Client Components). Usa la anon key →
 * RLS aplica: el usuario sólo accede a sus propias filas (doc 08 §4).
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
