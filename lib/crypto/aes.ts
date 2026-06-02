import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado simétrico AES-256-GCM app-level (doc 10 §4.4). Se usa para PII de
 * columna (A-Number). La clave (`APP_ENCRYPTION_KEY`, 32 bytes hex) vive SOLO en
 * el server (.env.local) y NUNCA toca la base de datos ni los logs SQL.
 *
 * Formato del blob: `iv(12) ‖ ciphertext ‖ authTag(16)`. GCM autentica: alterar
 * cualquier byte hace fallar el descifrado (integridad, no sólo confidencialidad).
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function key(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (!hex) throw new Error("APP_ENCRYPTION_KEY no está configurada");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== KEY_LEN) {
    throw new Error(`APP_ENCRYPTION_KEY debe ser ${KEY_LEN} bytes (${KEY_LEN * 2} hex)`);
  }
  return buf;
}

/** Cifra `plaintext` → blob `iv ‖ ciphertext ‖ tag`. */
export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]);
}

/** Descifra un blob `iv ‖ ciphertext ‖ tag`. Lanza si fue alterado o la clave no coincide. */
export function decrypt(blob: Buffer): string {
  if (blob.length < IV_LEN + TAG_LEN) throw new Error("Blob cifrado inválido (demasiado corto)");
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const ciphertext = blob.subarray(IV_LEN, blob.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
