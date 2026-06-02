import { randomUUID } from "node:crypto";
import { decryptANumber, encryptANumber, maskANumber } from "@/lib/crypto/anumber";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Verificación E2E de la Capa A (Fase 3) contra el proyecto Supabase real.
 * Crea un usuario de prueba, comprueba el trigger de perfil, el cifrado del
 * A-Number round-trip y el soft-delete; al final BORRA el usuario (cascade).
 *
 * Ejecutar: node --env-file=.env.local --import tsx scripts/verify-phase3.ts
 */

function assert(cond: unknown, label: string): asserts cond {
  if (!cond) throw new Error(`FALLÓ: ${label}`);
  console.log(`  ✓ ${label}`);
}

async function main(): Promise<void> {
  const admin = createAdminClient();
  const email = `phase3-${randomUUID()}@example.com`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { language: "en", full_name: "Phase 3 Test" },
  });
  if (createErr) throw createErr;
  const userId = created.user.id;
  console.log(`Usuario de prueba: ${userId}`);

  try {
    // 1. el trigger handle_new_user creó el perfil con el idioma del metadata
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (pErr) throw pErr;
    assert(profile, "perfil auto-creado por el trigger");
    assert(profile.language === "en", "idioma tomado del metadata del signup");
    assert(profile.plan === "free", "plan por defecto = free");

    // 2. caso con A-Number cifrado a nivel columna
    const aNumber = "A123456789";
    const { data: caseRow, error: cErr } = await admin
      .from("cases")
      .insert({
        user_id: userId,
        source: "eoir",
        alien_number_enc: encryptANumber(aNumber),
        nationality: "PE",
      })
      .select("id, alien_number_enc")
      .single();
    if (cErr) throw cErr;
    const enc = caseRow.alien_number_enc;
    assert(enc, "A-Number guardado como bytea cifrado");
    assert(enc !== aNumber && !enc.includes("123456789"), "el A-Number NO se guarda en claro");

    // 3. round-trip de descifrado
    const decrypted = decryptANumber(enc);
    assert(decrypted === aNumber, "descifrado round-trip del A-Number");
    console.log(`  · masking en UI/logs: ${maskANumber(decrypted)}`);

    // 4. soft-delete
    const { error: sErr } = await admin
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", userId);
    if (sErr) throw sErr;
    const { data: afterSoft } = await admin
      .from("profiles")
      .select("deleted_at")
      .eq("id", userId)
      .single();
    assert(afterSoft?.deleted_at, "soft-delete marca deleted_at");

    console.log("\n✅ Capa A verificada E2E (trigger, cifrado, soft-delete).");
  } finally {
    // limpieza: borrar el usuario de prueba (cascade borra perfil y casos)
    await admin.auth.admin.deleteUser(userId);
    const { count } = await admin
      .from("cases")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    console.log(`Limpieza: usuario borrado; casos residuales = ${count ?? 0}`);
  }
}

main().catch((err: unknown) => {
  console.error("\n❌", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
