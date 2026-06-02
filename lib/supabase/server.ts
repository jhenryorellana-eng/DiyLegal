import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

/**
 * Cliente Supabase para el servidor (Server Components, Route Handlers, Server
 * Actions). Usa la anon key con la sesión del usuario (cookies) → RLS aplica.
 * Para operaciones que deben saltarse RLS usar `admin.ts` (service_role).
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Llamado desde un Server Component: las cookies son de sólo lectura
          // aquí. El refresco de sesión lo hace el middleware (patrón oficial
          // @supabase/ssr); ignorar es intencional, no un error silenciado.
        }
      },
    },
  });
}
