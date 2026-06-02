import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

/**
 * Refresca la sesión de Supabase en cada request (patrón oficial @supabase/ssr).
 * Reescribe las cookies del token rotado en la respuesta. Se invoca desde el
 * `middleware.ts` raíz. No realiza redirecciones de auth (eso vive en las rutas).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() valida el token y lo rota si hace falta (no usar getSession aquí).
  await supabase.auth.getUser();
  return response;
}
