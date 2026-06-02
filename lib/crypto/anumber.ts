import { decrypt, encrypt } from "@/lib/crypto/aes";

/**
 * Cifrado y enmascarado del A-Number (Alien Registration Number) — la PII más
 * sensible (doc 10 §4.4). Se guarda cifrado en `cases.alien_number_enc bytea` y
 * se enmascara en UI/logs (`A1**-***-789`). Nunca se loguea en claro (doc 10 §111).
 */

/** Normaliza a `A` + dígitos (quita prefijo, espacios y guiones). */
export function normalizeANumber(input: string): string {
  return `A${input.replace(/\D/g, "")}`;
}

/** `A123456789` → `A1**-***-789` (primer dígito + últimos 3). */
export function maskANumber(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 4) return "A***-***-***";
  return `A${digits.slice(0, 1)}**-***-${digits.slice(-3)}`;
}

/**
 * Cifra el A-Number a formato literal `bytea` de Postgres (`\x...` hex), apto
 * para insertar en `cases.alien_number_enc` vía PostgREST/supabase-js.
 */
export function encryptANumber(input: string): string {
  return `\\x${encrypt(normalizeANumber(input)).toString("hex")}`;
}

/** Descifra el valor `bytea` (`\x...` hex) devuelto por Postgres → A-Number. */
export function decryptANumber(byteaHex: string): string {
  const hex = byteaHex.startsWith("\\x") ? byteaHex.slice(2) : byteaHex;
  return decrypt(Buffer.from(hex, "hex"));
}
