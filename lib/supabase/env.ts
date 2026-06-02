/**
 * Lectura validada de las variables públicas de Supabase (doc 08, doc 10).
 * `NEXT_PUBLIC_*` se inyectan en build y son seguras en el cliente (la anon key
 * respeta RLS). La service_role NO se lee aquí (sólo en `admin.ts`, server-only).
 */

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL no está configurada");
  return url;
}

export function supabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY no está configurada");
  return key;
}
