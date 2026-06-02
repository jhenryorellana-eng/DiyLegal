import "server-only";
import { requireUserClient } from "@/lib/auth/session";

/**
 * Borrado de cuenta (doc 10 §7). Soft-delete inmediato (marca `deleted_at`);
 * un job pg_cron purga los datos a los 30 días (`purge_deleted_accounts`).
 * Cancelable dentro de la ventana.
 */

/** Marca la cuenta para borrado (soft-delete). */
export async function requestAccountDeletion(): Promise<void> {
  const { supabase, userId } = await requireUserClient();
  const { error } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

/** Cancela un borrado pendiente dentro de la ventana de 30 días. */
export async function cancelAccountDeletion(): Promise<void> {
  const { supabase, userId } = await requireUserClient();
  const { error } = await supabase.from("profiles").update({ deleted_at: null }).eq("id", userId);
  if (error) throw error;
}
