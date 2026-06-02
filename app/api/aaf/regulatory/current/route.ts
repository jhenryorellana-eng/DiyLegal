import { aafEnabled } from "@/lib/aaf/config";
import { loadRegulatory } from "@/lib/aaf/regulatory";
import { jsonErr, jsonOk } from "@/lib/http/response";

/**
 * GET /api/aaf/regulatory/current (doc 13 §5, doc 07 §4.4).
 * Monto vigente + pausas activas + lastCheck. Cache-first con fallback a la
 * semilla del doc 13; el cron `regulatory-check` mantiene el cache al día.
 */
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  if (!aafEnabled("regulatoryCheck")) {
    return jsonErr("ConfigMissing", "La vigilancia regulatoria del AAF no está habilitada");
  }

  const { snapshot, fromCache, fetchedAt } = await loadRegulatory();
  return jsonOk({ ...snapshot, fromCache, fetchedAt });
}
