import { saveCache } from "@/lib/feeds/cache";
import { DMV_CACHE, fetchDmv } from "@/lib/feeds/dmv";
import { feedEnabled } from "@/lib/feeds/config";
import { authorizedCron } from "@/lib/cron/authorized-cron";
import { jsonErr, jsonFrom, jsonOk } from "@/lib/http/response";

/**
 * Cron dmv-sync (mensual, día 1 07:30 UTC, vercel.json).
 * Refresca el cache de manuales DMV con Gemini grounded.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const auth = authorizedCron(request);
  if (auth) return jsonFrom(auth);

  if (!feedEnabled("dmv")) {
    return jsonErr("ConfigMissing", "Los manuales DMV no están habilitados");
  }

  try {
    const data = await fetchDmv();
    await saveCache(DMV_CACHE, data);
    return jsonOk({ synced: true, states: data.states.length, asOf: data.asOf });
  } catch (error) {
    return jsonErr("BackendUnavailable", error instanceof Error ? error.message : "sync falló");
  }
}
