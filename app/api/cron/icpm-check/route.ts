import { aafEnabled } from "@/lib/aaf/config";
import { ICPM_CACHE_NAME, type IcpmCache, refreshIcpm } from "@/lib/aaf/icpm-check";
import { authorizedCron } from "@/lib/cron/authorized-cron";
import { loadCache, saveCache } from "@/lib/feeds/cache";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";

/**
 * Cron icpm-check (semanal, lunes 06:00 UTC, vercel.json). Descarga el ICPM y lo
 * cachea con dedup por SHA-256 (doc 13 §3.4).
 *
 * NOTA (deuda transversal, lessons 2026-06-01): `saveCache` escribe en /data, que
 * NO persiste en Vercel serverless. Resolver el storage real en Fase 5/11.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = authorizedCron(request);
  if (auth) return jsonFrom(auth);

  if (!aafEnabled("icpmGrounding")) {
    return jsonErr("ConfigMissing", "El grounding ICPM no está habilitado");
  }

  try {
    const previous = await loadCache<IcpmCache>(ICPM_CACHE_NAME);
    const { cache, changed } = await refreshIcpm(new Date().toISOString(), previous?.data ?? null);
    await saveCache(ICPM_CACHE_NAME, cache);
    return jsonOk({ synced: true, sources: cache.entries.length, changed });
  } catch (error) {
    return jsonErr("BackendUnavailable", error instanceof Error ? error.message : "sync falló");
  }
}
