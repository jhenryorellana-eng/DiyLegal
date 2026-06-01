import { loadCache, saveCache } from "@/lib/feeds/cache";
import { feedEnabled } from "@/lib/feeds/config";
import { VACCINES_CACHE, type VaccinesData, fetchVaccines } from "@/lib/feeds/vaccines";
import { jsonErr, jsonOk } from "@/lib/http/response";

/**
 * GET /api/static/vaccines (doc 07 §4.5, doc 09 §10).
 * Cache-first (Gemini cuesta): sirve el cache; el cron lo refresca. En arranque
 * en frío hace UNA llamada a Gemini y persiste; si falla → 502.
 */
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  if (!feedEnabled("vaccines")) {
    return jsonErr("ConfigMissing", "La lista de vacunas no está habilitada");
  }

  const cached = await loadCache<VaccinesData>(VACCINES_CACHE);
  if (cached) {
    return jsonOk({ ...cached.data, cachedAt: cached.fetchedAt });
  }

  try {
    const data = await fetchVaccines();
    await saveCache(VACCINES_CACHE, data);
    return jsonOk(data);
  } catch {
    return jsonErr("BackendUnavailable", "No se pudo obtener la lista de vacunas");
  }
}
