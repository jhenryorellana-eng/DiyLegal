import { saveCache } from "@/lib/feeds/cache";
import { feedEnabled } from "@/lib/feeds/config";
import { TRAVEL_ADVISORIES_CACHE, fetchTravelAdvisories } from "@/lib/feeds/travel-advisories";
import { authorizedCron } from "@/lib/cron/authorized-cron";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";

/**
 * Cron travel-advisories-sync (lunes 09:00 UTC, vercel.json) — doc 07 §4.6.
 * Refresca el cache base usado como fallback por el endpoint.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = authorizedCron(request);
  if (auth) return jsonFrom(auth);

  if (!feedEnabled("travelAdvisories")) {
    return jsonErr("ConfigMissing", "Los avisos de viaje no están habilitados");
  }

  try {
    const all = await fetchTravelAdvisories();
    await saveCache(TRAVEL_ADVISORIES_CACHE, all);
    return jsonOk({ synced: true, count: all.length });
  } catch (error) {
    return jsonErr("BackendUnavailable", error instanceof Error ? error.message : "sync falló");
  }
}
