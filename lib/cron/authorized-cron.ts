import { type ApiError, err } from "@/lib/http/response";

/**
 * Autoriza la ejecución de un cron de la Capa B (doc 07 §3, doc 12 §crons).
 *
 * Acepta `Authorization: Bearer <INTERNAL_CRON_SECRET>` o el header
 * `x-vercel-cron-secret` con el mismo secreto. Devuelve:
 *   - `null` si está autorizado.
 *   - `ApiError("Unauthorized")` (401) si el secreto no coincide.
 *   - `ApiError("ConfigMissing")` (503) si no hay secreto configurado.
 *
 * La comparación es de tiempo constante para no filtrar el secreto por timing.
 */
export function authorizedCron(request: Request): ApiError | null {
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!secret) {
    return err("ConfigMissing", "INTERNAL_CRON_SECRET no está configurado");
  }

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  const vercelSecret = request.headers.get("x-vercel-cron-secret");

  if (safeEqual(bearer, secret) || safeEqual(vercelSecret, secret)) {
    return null;
  }
  return err("Unauthorized", "Cron no autorizado");
}

/** Comparación de strings en tiempo constante (mitiga timing attacks). */
function safeEqual(candidate: string | null, expected: string): boolean {
  if (candidate === null || candidate.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
