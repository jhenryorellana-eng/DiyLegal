import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Cliente Supabase + id del usuario autenticado, o lanza si no hay sesión.
 * Base compartida de las operaciones de perfil/cuenta (server-only, RLS aplica).
 */
export async function requireUserClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}
