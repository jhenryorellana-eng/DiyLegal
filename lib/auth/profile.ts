import "server-only";
import { CONSENT_VERSION } from "@/lib/auth/consent";
import { requireUserClient } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

/**
 * Helpers de perfil del usuario autenticado (doc 08 §3.1, doc 10 §2).
 * Server-only: usan la sesión (cookies) con la anon key → RLS garantiza que
 * cada usuario sólo lee/escribe su propia fila. El perfil se auto-crea en el
 * signup (trigger `handle_new_user`); aquí se completan idioma y consentimiento.
 */

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Language = "es" | "en";

/** Perfil del usuario actual (o `null` si no hay sesión). */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Registra la aceptación del consentimiento vigente (versión + timestamp UTC). */
export async function recordConsent(): Promise<void> {
  const { supabase, userId } = await requireUserClient();
  const { error } = await supabase
    .from("profiles")
    .update({ consent_version: CONSENT_VERSION, consent_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/** Cambia el idioma preferido del usuario (es/en). */
export async function setLanguage(language: Language): Promise<void> {
  const { supabase, userId } = await requireUserClient();
  const { error } = await supabase.from("profiles").update({ language }).eq("id", userId);
  if (error) throw error;
}
